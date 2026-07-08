import * as DocumentPicker from 'expo-document-picker';
import { File as FsFile } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  Icon,
  Input,
  Screen,
  Select,
  type SelectOption,
  Text,
  useToast,
} from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import {
  ApiError,
  configApi,
  googleImportApi,
  importApi,
  type ImportCandidate,
  type ImportCommitItem,
  type ImportPreviewResponse,
  type ImportPreviewRow,
  type ImportResolution,
} from '@/lib/api';
import { importDeviceContacts } from '@/lib/contacts';
import { MAX_IMPORT_ROWS, parseCsv } from '@/lib/csv';
import { maxDayInMonth, monthAbbr } from '@/lib/dates';
import { connectGoogleImport } from '@/lib/google-import-auth';
import { useAuth } from '@/providers/auth-provider';
import { useTokens } from '@/theme/theme-provider';

/**
 * Bulk import (TODO Stage 7; FR-6/11). Three phases:
 *   • input   - scan device contacts (native only) or paste/upload a CSV (all
 *     platforms - the only import path on web, where there's no address book).
 *   • preview - the server's annotated rows: ready / possible duplicates (resolve
 *     each as keep both / merge / skip) / couldn't-read. Nothing is created yet.
 *   • summary - what actually happened (added / merged / skipped / unreadable).
 * A duplicate is never silently merged or skipped - the user chooses (FR-11).
 */

type Phase = 'input' | 'preview' | 'summary';

// System monospace for the CSV paste box (columns line up; no bundled mono font).
const MONO_FONT = Platform.select({ ios: 'Menlo', default: 'monospace' });

// Android's mime filtering is unreliable (providers report .csv as text/plain
// or worse), so cast a wide net on native; web `accept` also honors extensions.
const CSV_PICKER_TYPES =
  Platform.OS === 'web'
    ? ['text/csv', 'text/comma-separated-values', '.csv']
    : ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv'];

const CURRENT_YEAR = new Date().getFullYear();

const MONTH_OPTIONS: SelectOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: monthAbbr(i + 1),
}));

/**
 * Local mirror of the commit validation, so the review list only offers to import
 * what the server will accept. Returns the fix (§10 voice) or null when the row is
 * good to go.
 */
function rowIssue(r: ImportPreviewRow): string | null {
  if (!r.name.trim()) return 'Add a name.';
  const d = r.dob;
  if (!d || !d.month || !d.day) return 'Add a birthday (month + day).';
  if (d.month < 1 || d.month > 12) return 'Pick a month.';
  if (d.day < 1 || d.day > maxDayInMonth(d.month)) return "That day isn't in the month.";
  if (d.year != null && (d.year < 1900 || d.year > CURRENT_YEAR)) return 'Check the year.';
  return null;
}

export default function ImportScreen() {
  const router = useRouter();
  const toast = useToast();
  const t = useTokens();
  const { user, refreshUser } = useAuth();
  const { source } = useLocalSearchParams<{ source?: string }>();

  const [phase, setPhase] = useState<Phase>('input');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ImportResolution>>({});
  const [summary, setSummary] = useState<{ added: number; merged: number; skipped: number } | null>(
    null,
  );
  const [unreadable, setUnreadable] = useState(0);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  // Is Google import provisioned on this server? (hides the card when it isn't).
  useEffect(() => {
    let active = true;
    configApi
      .get()
      .then((c) => {
        if (active) setGoogleAvailable(!!c.googleImportAvailable);
      })
      .catch(() => {
        /* leave the card hidden if config can't be read */
      });
    return () => {
      active = false;
    };
  }, []);

  // Move annotated rows into the review phase (shared by every source).
  const applyPreview = useCallback((res: ImportPreviewResponse, emptyMessage: string): boolean => {
    if (res.rows.length === 0) {
      setError(emptyMessage);
      return false;
    }
    // Duplicates default to "skip" - nothing is created or merged without a choice.
    const init: Record<string, ImportResolution> = {};
    for (const r of res.rows) if (r.status === 'duplicate') init[r.id] = 'skip';
    setRows(res.rows);
    setResolutions(init);
    setPhase('preview');
    return true;
  }, []);

  const runPreview = useCallback(
    async (candidates: ImportCandidate[]) => {
      setBusy(true);
      setError(null);
      try {
        const res = await importApi.preview({ candidates });
        applyPreview(res, 'There was nothing to import. Add at least one person with a birthday.');
      } catch (e) {
        setError(
          e instanceof ApiError ? e.message : "Couldn't read that. Check the format and try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [applyPreview],
  );

  // Import from Google Calendar + Contacts. Requests the calendar/contacts scopes
  // just-in-time (only here, never at login); on an expired grant, asks to reconnect.
  const runGooglePreview = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!user?.googleImportConnected) {
        const result = await connectGoogleImport();
        if (result === 'dismissed') return;
        if (result !== 'connected') {
          setError("Couldn't connect Google. Please try again.");
          return;
        }
        await refreshUser();
      }
      const res = await googleImportApi.preview();
      const ok = applyPreview(
        res,
        "We didn't find any birthdays in your Google Calendar or Contacts to import.",
      );
      if (ok && res.truncated) {
        toast.show('Showing the first 2,000. Import them, then run it again for the rest.');
      }
    } catch (e) {
      const code = e instanceof ApiError ? (e.data as { code?: string } | null)?.code : undefined;
      if (code === 'google_import_disconnected') {
        await refreshUser();
        setError('Your Google connection expired. Tap "Import from Google" to reconnect.');
        return;
      }
      setError(
        e instanceof ApiError
          ? e.message
          : "Couldn't reach Google. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [applyPreview, user, refreshUser, toast]);

  const scanContacts = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await importDeviceContacts();
      if (result.status === 'denied') {
        toast.show('Contact access is off. Enable it in settings to import.');
        return;
      }
      if (result.status === 'unsupported') {
        setError("Contact import isn't available here. Add people manually instead.");
        return;
      }
      if (result.status === 'error') {
        toast.show(result.message);
        return;
      }
      if (result.candidates.length === 0) {
        setError("None of your contacts have a birthday saved, so there's nothing to import.");
        return;
      }
      await runPreview(result.candidates);
    } finally {
      setBusy(false);
    }
  }, [runPreview, toast]);

  const previewCsv = useCallback(
    async (text: string) => {
      // Backstop for the paste path (files are size-checked before reading);
      // matches the server's 2 MB csv cap.
      if (text.length > 2_000_000) {
        setError('That CSV is too big. Keep an import under 2 MB.');
        return;
      }
      const candidates = parseCsv(text);
      if (candidates.length === 0) {
        setError(
          'No rows found. The first line must be a header (like name,month,day) with at least one row below it.',
        );
        return;
      }
      if (candidates.length > MAX_IMPORT_ROWS) {
        setError(
          `That's ${candidates.length.toLocaleString()} rows - imports are capped at ${MAX_IMPORT_ROWS.toLocaleString()}. Split the file and run it in batches.`,
        );
        return;
      }
      // Parse feedback before the server round-trip, like the scan's toasts.
      toast.show(`${candidates.length} ${candidates.length === 1 ? 'row' : 'rows'} parsed.`);
      await runPreview(candidates);
    },
    [runPreview, toast],
  );

  const pickCsvFile = useCallback(async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: CSV_PICKER_TYPES,
        copyToCacheDirectory: true,
        base64: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      // Web assets carry a DOM File; native ones a cache uri for expo-file-system.
      const file = asset.file ?? new FsFile(asset.uri);
      // Refuse huge picks before materializing them in memory (Android's picker
      // happily returns any text/plain file, and some providers report no size -
      // stat the cached copy then); the server caps CSVs at 2 MB too.
      const size = asset.size ?? file.size;
      if (size != null && size > 2_000_000) {
        setError('That file is too big. Keep an import under 2 MB.');
        return;
      }
      const text = await file.text();
      setCsvText(text);
      await previewCsv(text);
    } catch {
      setError("Couldn't read that file. Check it's a plain .csv and try again.");
    }
  }, [previewCsv]);

  // Arriving via "Import from contacts" (source=contacts) auto-starts the scan (native).
  const autoScanned = useRef(false);
  useEffect(() => {
    if (source === 'contacts' && Platform.OS !== 'web' && !autoScanned.current) {
      autoScanned.current = true;
      void scanContacts();
    }
  }, [source, scanContacts]);

  // Returning from the Google OAuth deep-link fallback (see
  // app/google-import-connected.tsx): source=google resumes the preview - the user
  // is already connected, so runGooglePreview skips the browser and fetches rows;
  // source=google-error surfaces the connect failure. This only runs when Android
  // dispatched the OAuth return as a fresh Intent instead of resolving the in-app
  // browser session.
  const autoGoogle = useRef(false);
  useEffect(() => {
    if (autoGoogle.current) return;
    if (source === 'google') {
      autoGoogle.current = true;
      void runGooglePreview();
    } else if (source === 'google-error') {
      autoGoogle.current = true;
      setError("Couldn't connect Google. Please try again.");
    }
  }, [source, runGooglePreview]);

  const setResolution = (id: string, resolution: ImportResolution) =>
    setResolutions((prev) => ({ ...prev, [id]: resolution }));

  // --- Editable review list -------------------------------------------------
  const newRowSeq = useRef(0);

  const patchRow = useCallback((id: string, patch: Partial<ImportPreviewRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  // Update one part of a row's dob, tolerating partial/blank entry mid-edit.
  const patchDob = useCallback((id: string, part: 'month' | 'day' | 'year', raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const base = r.dob ?? { month: 0, day: 0, year: null };
        const n = digits === '' ? null : Number(digits);
        return {
          ...r,
          dob: {
            month: part === 'month' ? Number(raw) || 0 : base.month,
            day: part === 'day' ? (n ?? 0) : base.day,
            year: part === 'year' ? (n && n > 0 ? n : null) : base.year,
          },
        };
      }),
    );
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addRow = useCallback(() => {
    const id = `new-${newRowSeq.current++}`;
    setRows((prev) => [
      ...prev,
      {
        id,
        name: '',
        relationshipTag: null,
        phone: null,
        photoUrl: null,
        dob: { month: new Date().getMonth() + 1, day: 0, year: null },
        email: null,
        events: [],
        status: 'ready',
        error: null,
        duplicate: null,
      },
    ]);
  }, []);

  // Rows we'll actually send: valid, and not a duplicate the user chose to skip.
  const importable = useMemo(
    () =>
      rows.filter((r) => {
        if (rowIssue(r)) return false;
        if (r.status === 'duplicate') return (resolutions[r.id] ?? 'skip') !== 'skip';
        return true;
      }),
    [rows, resolutions],
  );

  const commit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const items: ImportCommitItem[] = importable.map((r) => {
        const resolution = r.status === 'duplicate' ? (resolutions[r.id] ?? 'skip') : 'add';
        return {
          name: r.name.trim(),
          relationshipTag: r.relationshipTag,
          phone: r.phone,
          photoUrl: r.photoUrl,
          dob: r.dob!,
          email: r.email,
          events: r.events,
          resolution,
          mergeTargetId: resolution === 'merge' ? (r.duplicate?.personId ?? null) : null,
        };
      });

      if (items.length === 0) {
        setError('Nothing to import yet. Add a name and birthday to a row.');
        return;
      }
      const res = await importApi.commit(items);
      // Rows left with a name/date problem (not sent) are surfaced in the summary.
      setUnreadable(rows.filter((r) => rowIssue(r)).length);
      setSummary(res.summary);
      setPhase('summary');
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Couldn't import. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [importable, rows, resolutions]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-between pb-2 pt-3">
        <Text variant="title">
          {phase === 'summary' ? 'Import complete' : phase === 'preview' ? 'Review import' : 'Import people'}
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className={cn('rounded-full', focusRing)}>
          <Icon icon={X} size={24} />
        </Pressable>
      </View>

      {phase === 'input' ? (
        <InputPhase
          onScan={scanContacts}
          csvText={csvText}
          onChangeCsv={setCsvText}
          onParseCsv={() => void previewCsv(csvText)}
          onPickFile={() => void pickCsvFile()}
          onImportGoogle={() => void runGooglePreview()}
          googleAvailable={googleAvailable}
          googleConnected={!!user?.googleImportConnected}
          googleEmail={user?.googleImportEmail ?? null}
          busy={busy}
          error={error}
        />
      ) : phase === 'preview' ? (
        <PreviewPhase
          rows={rows}
          resolutions={resolutions}
          importCount={importable.length}
          setResolution={setResolution}
          onPatchRow={patchRow}
          onPatchDob={patchDob}
          onRemoveRow={removeRow}
          onAddRow={addRow}
          onBack={() => setPhase('input')}
          onImport={commit}
          busy={busy}
          error={error}
        />
      ) : (
        <SummaryPhase
          summary={summary!}
          unreadable={unreadable}
          onDone={() => router.back()}
          onMore={() => {
            setRows([]);
            setResolutions({});
            setSummary(null);
            setError(null);
            setCsvText('');
            setPhase('input');
          }}
          tint={t.biro}
        />
      )}
    </Screen>
  );
}

// --- Input phase ------------------------------------------------------------

function InputPhase({
  onScan,
  csvText,
  onChangeCsv,
  onParseCsv,
  onPickFile,
  onImportGoogle,
  googleAvailable,
  googleConnected,
  googleEmail,
  busy,
  error,
}: {
  onScan: () => void;
  csvText: string;
  onChangeCsv: (text: string) => void;
  onParseCsv: () => void;
  onPickFile: () => void;
  onImportGoogle: () => void;
  googleAvailable: boolean;
  googleConnected: boolean;
  googleEmail: string | null;
  busy: boolean;
  error: string | null;
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32, gap: 20 }}>
      {googleAvailable ? (
        <Pressable
          onPress={onImportGoogle}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={googleConnected ? 'Sync birthdays from Google' : 'Connect Google to import'}
          className={cn('rounded-lg', focusRing)}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-sunken">
              <Icon icon={CalendarPlus} size={20} />
            </View>
            <View className="flex-1">
              <Text variant="cardName">Import from Google</Text>
              <Text variant="caption" className="mt-0.5 text-ink-secondary">
                {googleConnected
                  ? `Birthdays + anniversaries from Google. Connected as ${googleEmail}.`
                  : 'Birthdays + anniversaries from your Google Calendar and Contacts. You review everything before it’s added.'}
              </Text>
            </View>
            <Icon icon={Download} size={20} />
          </Card>
        </Pressable>
      ) : null}

      {Platform.OS !== 'web' ? (
        <Pressable
          onPress={onScan}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Scan device contacts"
          className={cn('rounded-lg', focusRing)}>
          <Card className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-sunken">
              <Icon icon={Users} size={20} />
            </View>
            <View className="flex-1">
              <Text variant="cardName">Scan device contacts</Text>
              <Text variant="caption" className="mt-0.5 text-ink-secondary">
                Imports everyone who has a birthday saved.
              </Text>
            </View>
            <Icon icon={Upload} size={20} />
          </Card>
        </Pressable>
      ) : null}

      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-sunken">
            <Icon icon={FileText} size={20} />
          </View>
          <View className="flex-1">
            <Text variant="cardName">Import from a CSV</Text>
            <Text variant="caption" className="mt-0.5 text-ink-secondary">
              Paste rows or upload a file. The first line is the header: name, month, day, then
              optional year, relationship, phone. A single birthday column (MM/DD/YYYY) also works.
            </Text>
          </View>
        </View>

        <Input
          value={csvText}
          onChangeText={onChangeCsv}
          multiline
          numberOfLines={6}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={'name,month,day,year,relationship\nAda Lovelace,12,10,1991,Friend'}
          accessibilityLabel="CSV rows"
          className="text-[13px]"
          style={{ fontFamily: MONO_FONT, minHeight: 120, textAlignVertical: 'top' }}
        />

        <Button fullWidth loading={busy} disabled={!csvText.trim()} onPress={onParseCsv}>
          Parse rows
        </Button>
        <Button variant="secondary" fullWidth leftIcon={FileUp} disabled={busy} onPress={onPickFile}>
          Upload a CSV file
        </Button>
      </Card>

      {error ? (
        <Text variant="caption" className="text-danger-fg">
          {error}
        </Text>
      ) : null}
    </ScrollView>
  );
}

// --- Preview phase ----------------------------------------------------------

function PreviewPhase({
  rows,
  resolutions,
  importCount,
  setResolution,
  onPatchRow,
  onPatchDob,
  onRemoveRow,
  onAddRow,
  onBack,
  onImport,
  busy,
  error,
}: {
  rows: ImportPreviewRow[];
  resolutions: Record<string, ImportResolution>;
  importCount: number;
  setResolution: (id: string, r: ImportResolution) => void;
  onPatchRow: (id: string, patch: Partial<ImportPreviewRow>) => void;
  onPatchDob: (id: string, part: 'month' | 'day' | 'year', raw: string) => void;
  onRemoveRow: (id: string) => void;
  onAddRow: () => void;
  onBack: () => void;
  onImport: () => void;
  busy: boolean;
  error: string | null;
}) {
  const incomplete = rows.filter((r) => rowIssue(r)).length;

  return (
    <View className="flex-1">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 16, gap: 12 }}>
        <View className="gap-0.5">
          <Text variant="body" className="text-ink-secondary">
            Edit anyone, remove rows you don’t want, or add someone we missed — then import.
          </Text>
          <Text variant="caption" className="text-ink-muted">
            {`${importCount} ready to import`}
            {incomplete > 0 ? ` · ${incomplete} need${incomplete === 1 ? 's' : ''} a name or birthday` : ''}
          </Text>
        </View>

        {rows.map((r) => (
          <EditableRow
            key={r.id}
            row={r}
            resolution={resolutions[r.id] ?? 'skip'}
            onPatch={(patch) => onPatchRow(r.id, patch)}
            onPatchDob={(part, raw) => onPatchDob(r.id, part, raw)}
            onRemove={() => onRemoveRow(r.id)}
            onSetResolution={(res) => setResolution(r.id, res)}
          />
        ))}

        <Pressable
          onPress={onAddRow}
          accessibilityRole="button"
          accessibilityLabel="Add a person"
          className={cn(
            'flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-3',
            focusRing,
          )}>
          <Icon icon={Plus} size={18} />
          <Text variant="cardName" className="text-ink-secondary">
            Add a person
          </Text>
        </Pressable>

        {error ? (
          <Text variant="caption" className="text-danger-fg">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View className="gap-2 border-t border-border-subtle pt-3">
        <Button fullWidth loading={busy} disabled={importCount === 0} onPress={onImport}>
          {importCount > 0
            ? `Import ${importCount} ${importCount === 1 ? 'person' : 'people'}`
            : 'Nothing to import'}
        </Button>
        <Button variant="ghost" fullWidth onPress={onBack}>
          Back
        </Button>
      </View>
    </View>
  );
}

/** One editable person in the review list: name, birthday, relationship, remove. */
function EditableRow({
  row,
  resolution,
  onPatch,
  onPatchDob,
  onRemove,
  onSetResolution,
}: {
  row: ImportPreviewRow;
  resolution: ImportResolution;
  onPatch: (patch: Partial<ImportPreviewRow>) => void;
  onPatchDob: (part: 'month' | 'day' | 'year', raw: string) => void;
  onRemove: () => void;
  onSetResolution: (r: ImportResolution) => void;
}) {
  const issue = rowIssue(row);
  const isDuplicate = row.status === 'duplicate';
  const canMerge = row.duplicate?.kind === 'existing';

  return (
    <Card className="gap-2.5">
      <View className="flex-row items-start gap-2">
        <View className="flex-1 gap-2.5">
          <Input
            value={row.name}
            onChangeText={(text) => onPatch({ name: text })}
            placeholder="Name"
            accessibilityLabel="Name"
            autoCapitalize="words"
          />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Select
                value={row.dob?.month ? String(row.dob.month) : undefined}
                options={MONTH_OPTIONS}
                onChange={(v) => onPatchDob('month', v)}
                placeholder="Month"
                accessibilityLabel="Birthday month"
              />
            </View>
            <Input
              className="w-[64px] text-center"
              value={row.dob?.day ? String(row.dob.day) : ''}
              onChangeText={(text) => onPatchDob('day', text)}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="Day"
              accessibilityLabel="Birthday day"
            />
            <Input
              className="w-[80px] text-center"
              value={row.dob?.year ? String(row.dob.year) : ''}
              onChangeText={(text) => onPatchDob('year', text)}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="Year"
              accessibilityLabel="Birth year, optional"
            />
          </View>
          <Input
            value={row.relationshipTag ?? ''}
            onChangeText={(text) => onPatch({ relationshipTag: text.trim() ? text : null })}
            placeholder="Relationship (optional)"
            accessibilityLabel="Relationship, optional"
          />
          {row.events.length > 0 ? (
            <Text variant="caption" className="text-ink-muted">
              {`+${row.events.length} other ${row.events.length === 1 ? 'date' : 'dates'} (anniversary/custom) will be added too`}
            </Text>
          ) : null}
          {issue ? (
            <Text variant="caption" className="text-danger-fg">
              {issue}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${row.name || 'row'}`}
          className={cn('rounded-md p-2', focusRing)}>
          <Icon icon={Trash2} size={20} />
        </Pressable>
      </View>

      {isDuplicate ? (
        <View className="gap-1.5 border-t border-border-subtle pt-2.5">
          <Text variant="caption" className="text-ink-muted">
            {row.duplicate?.kind === 'existing'
              ? `Looks like ${row.duplicate.fullName}, already saved.`
              : 'Repeated earlier in this import.'}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip label="Skip" selected={resolution === 'skip'} onPress={() => onSetResolution('skip')} />
            {canMerge ? (
              <Chip label="Merge" selected={resolution === 'merge'} onPress={() => onSetResolution('merge')} />
            ) : null}
            <Chip label="Keep both" selected={resolution === 'add'} onPress={() => onSetResolution('add')} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

// --- Summary phase ----------------------------------------------------------

function SummaryPhase({
  summary,
  unreadable,
  onDone,
  onMore,
  tint,
}: {
  summary: { added: number; merged: number; skipped: number };
  unreadable: number;
  onDone: () => void;
  onMore: () => void;
  tint: string;
}) {
  const parts = [
    `${summary.added} added`,
    summary.merged ? `${summary.merged} merged` : null,
    summary.skipped ? `${summary.skipped} skipped` : null,
    unreadable ? `${unreadable} couldn't be read` : null,
  ].filter(Boolean) as string[];

  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-surface-sunken">
        <Icon icon={summary.added + summary.merged > 0 ? CheckCircle2 : AlertTriangle} size={24} color={tint} />
      </View>
      <Text variant="heading" className="text-center">
        {summary.added + summary.merged > 0 ? 'Import complete.' : 'Nothing was added.'}
      </Text>
      <Text variant="body" className="mt-2 text-center text-ink-secondary">
        {parts.join(' · ') + '.'}
      </Text>
      <View className="mt-6 w-full max-w-[320px] gap-2">
        <Button fullWidth onPress={onDone}>
          Done
        </Button>
        <Button variant="ghost" fullWidth onPress={onMore}>
          Import more
        </Button>
      </View>
    </View>
  );
}
