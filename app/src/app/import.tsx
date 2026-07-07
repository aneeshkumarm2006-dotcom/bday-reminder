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
  Upload,
  Users,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  Icon,
  Input,
  Screen,
  Text,
  useToast,
} from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import {
  ApiError,
  configApi,
  googleImportApi,
  importApi,
  type DateParts,
  type ImportCandidate,
  type ImportCommitItem,
  type ImportPreviewResponse,
  type ImportPreviewRow,
  type ImportResolution,
} from '@/lib/api';
import { importDeviceContacts } from '@/lib/contacts';
import { MAX_IMPORT_ROWS, parseCsv } from '@/lib/csv';
import { monthAbbr } from '@/lib/dates';
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

function formatDob(dob: DateParts): string {
  const base = `${monthAbbr(dob.month)} ${dob.day}`;
  return dob.year != null ? `${base}, ${dob.year}` : base;
}

/** A ready row's subtitle: the birthday, plus a count of extra dates (Google import). */
function readySub(row: ImportPreviewRow): string {
  const parts = [formatDob(row.dob!)];
  if (row.events.length > 0) {
    parts.push(`+${row.events.length} ${row.events.length === 1 ? 'other date' : 'other dates'}`);
  }
  return parts.join(' · ');
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

  const setResolution = (id: string, resolution: ImportResolution) =>
    setResolutions((prev) => ({ ...prev, [id]: resolution }));

  const commit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const items = rows
        .map((r): ImportCommitItem | null => {
          if (r.status === 'invalid' || !r.dob) return null;
          const resolution = r.status === 'duplicate' ? (resolutions[r.id] ?? 'skip') : 'add';
          return {
            name: r.name,
            relationshipTag: r.relationshipTag,
            phone: r.phone,
            photoUrl: r.photoUrl,
            dob: r.dob,
            email: r.email,
            events: r.events,
            resolution,
            mergeTargetId: resolution === 'merge' ? (r.duplicate?.personId ?? null) : null,
          };
        })
        .filter((x): x is ImportCommitItem => x !== null);

      if (items.length === 0) {
        setError('There was nothing to import.');
        return;
      }
      const res = await importApi.commit(items);
      setUnreadable(rows.filter((r) => r.status === 'invalid').length);
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
  }, [rows, resolutions]);

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
          setResolution={setResolution}
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
  setResolution,
  onBack,
  onImport,
  busy,
  error,
}: {
  rows: ImportPreviewRow[];
  resolutions: Record<string, ImportResolution>;
  setResolution: (id: string, r: ImportResolution) => void;
  onBack: () => void;
  onImport: () => void;
  busy: boolean;
  error: string | null;
}) {
  const ready = rows.filter((r) => r.status === 'ready');
  const duplicates = rows.filter((r) => r.status === 'duplicate');
  const invalid = rows.filter((r) => r.status === 'invalid');

  const adds =
    ready.length + duplicates.filter((r) => (resolutions[r.id] ?? 'skip') === 'add').length;
  const merges = duplicates.filter((r) => (resolutions[r.id] ?? 'skip') === 'merge').length;
  const skips = duplicates.filter((r) => (resolutions[r.id] ?? 'skip') === 'skip').length;

  return (
    <View className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, gap: 20 }}>
        {ready.length > 0 ? (
          <Section label={`Ready to add · ${ready.length}`}>
            {ready.map((r) => (
              <RowLine key={r.id} name={r.name} sub={readySub(r)} />
            ))}
          </Section>
        ) : null}

        {duplicates.length > 0 ? (
          <Section label={`Possible duplicates · ${duplicates.length}`}>
            <Text variant="caption" className="mb-1 text-ink-muted">
              We found these already saved. Choose what to do: nothing is merged without you.
            </Text>
            {duplicates.map((r) => (
              <DuplicateRow
                key={r.id}
                row={r}
                resolution={resolutions[r.id] ?? 'skip'}
                onChange={(res) => setResolution(r.id, res)}
              />
            ))}
          </Section>
        ) : null}

        {invalid.length > 0 ? (
          <Section label={`Couldn't read · ${invalid.length}`}>
            {invalid.map((r) => (
              <RowLine
                key={r.id}
                name={r.name || 'Unnamed row'}
                sub={r.error ?? 'This row was skipped.'}
                muted
              />
            ))}
          </Section>
        ) : null}

        {error ? (
          <Text variant="caption" className="text-danger-fg">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View className="gap-2 border-t border-border-subtle pt-3">
        <Text variant="caption" className="text-ink-muted">
          {`Adding ${adds} · merging ${merges} · skipping ${skips}${invalid.length ? ` · ${invalid.length} unreadable` : ''}.`}
        </Text>
        <Button fullWidth loading={busy} disabled={adds + merges === 0} onPress={onImport}>
          {adds + merges > 0 ? `Import ${adds + merges} ${adds + merges === 1 ? 'person' : 'people'}` : 'Nothing to import'}
        </Button>
        <Button variant="ghost" fullWidth onPress={onBack}>
          Back
        </Button>
      </View>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text variant="label" className="text-ink-muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

function RowLine({ name, sub, muted }: { name: string; sub: string; muted?: boolean }) {
  return (
    <View className="rounded-md bg-surface-sunken px-3 py-2">
      <Text variant="cardName" className={muted ? 'text-ink-secondary' : undefined}>
        {name}
      </Text>
      <Text variant="caption" className={muted ? 'text-danger-fg' : 'text-ink-secondary'}>
        {sub}
      </Text>
    </View>
  );
}

function DuplicateRow({
  row,
  resolution,
  onChange,
}: {
  row: ImportPreviewRow;
  resolution: ImportResolution;
  onChange: (r: ImportResolution) => void;
}) {
  const canMerge = row.duplicate?.kind === 'existing';
  const hint =
    row.duplicate?.kind === 'existing'
      ? `Looks like ${row.duplicate.fullName}, already saved.`
      : 'Repeated earlier in this import.';
  return (
    <Card className="gap-2">
      <View>
        <Text variant="cardName">{row.name}</Text>
        <Text variant="caption" className="mt-0.5 text-ink-secondary">
          {row.dob ? `${formatDob(row.dob)} · ${hint}` : hint}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Chip label="Skip" selected={resolution === 'skip'} onPress={() => onChange('skip')} />
        {canMerge ? (
          <Chip label="Merge" selected={resolution === 'merge'} onPress={() => onChange('merge')} />
        ) : null}
        <Chip label="Keep both" selected={resolution === 'add'} onPress={() => onChange('add')} />
      </View>
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
