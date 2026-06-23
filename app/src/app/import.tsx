import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle2,
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
  Screen,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import {
  ApiError,
  importApi,
  type DateParts,
  type ImportCandidate,
  type ImportCommitItem,
  type ImportPreviewRow,
  type ImportResolution,
} from '@/lib/api';
import { importDeviceContacts } from '@/lib/contacts';
import { monthAbbr } from '@/lib/dates';
import { useTokens } from '@/theme/theme-provider';

/**
 * Bulk import (TODO Stage 7; FR-6/7/11). Three phases:
 *   • input   — scan device contacts (native) or paste a CSV.
 *   • preview — the server's annotated rows: ready / possible duplicates (resolve
 *     each as keep both / merge / skip) / couldn't-read. Nothing is created yet.
 *   • summary — what actually happened (added / merged / skipped / unreadable).
 * A duplicate is never silently merged or skipped — the user chooses (FR-11).
 */

type Phase = 'input' | 'preview' | 'summary';

const CSV_PLACEHOLDER =
  'name, relationship, date of birth, phone\nPriya Sharma, Friend, 1994-03-05, +15551234\nDad, Family, 5 June 1961,';

function formatDob(dob: DateParts): string {
  const base = `${monthAbbr(dob.month)} ${dob.day}`;
  return dob.year != null ? `${base}, ${dob.year}` : base;
}

export default function ImportScreen() {
  const router = useRouter();
  const toast = useToast();
  const t = useTokens();
  const { source } = useLocalSearchParams<{ source?: string }>();

  const [phase, setPhase] = useState<Phase>('input');
  const [csvText, setCsvText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ImportResolution>>({});
  const [summary, setSummary] = useState<{ added: number; merged: number; skipped: number } | null>(
    null,
  );
  const [unreadable, setUnreadable] = useState(0);

  const runPreview = useCallback(
    async (input: { csv?: string; candidates?: ImportCandidate[] }) => {
      setBusy(true);
      setError(null);
      try {
        const res = await importApi.preview(input);
        if (res.rows.length === 0) {
          setError('There was nothing to import. Add at least one person with a birthday.');
          return;
        }
        // Duplicates default to "skip" — nothing is created or merged without a choice.
        const init: Record<string, ImportResolution> = {};
        for (const r of res.rows) if (r.status === 'duplicate') init[r.id] = 'skip';
        setRows(res.rows);
        setResolutions(init);
        setPhase('preview');
      } catch (e) {
        setError(
          e instanceof ApiError ? e.message : "Couldn't read that. Check the format and try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [],
  );

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
        setError("Contact import isn't available here. Paste a CSV or add people manually.");
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
      await runPreview({ candidates: result.candidates });
    } finally {
      setBusy(false);
    }
  }, [runPreview, toast]);

  // Arriving from onboarding's "Import from contacts" auto-starts the scan (native).
  const autoScanned = useRef(false);
  useEffect(() => {
    if (source === 'contacts' && Platform.OS !== 'web' && !autoScanned.current) {
      autoScanned.current = true;
      void scanContacts();
    }
  }, [source, scanContacts]);

  // Web-only: load a .csv file into the paste box (a real "file upload", FR-7).
  const pickCsvFile = () => {
    if (Platform.OS !== 'web') return;
    const g = globalThis as {
      document?: {
        createElement: (tag: string) => {
          type: string;
          accept: string;
          files?: { 0?: unknown; length: number }[] | unknown;
          onchange: (() => void) | null;
          click: () => void;
        };
      };
      FileReader?: new () => {
        result: unknown;
        onload: (() => void) | null;
        readAsText: (file: unknown) => void;
      };
    };
    if (!g.document || !g.FileReader) return;
    const input = g.document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv,text/plain';
    input.onchange = () => {
      const file = (input.files as { 0?: unknown }[] | undefined)?.[0];
      if (!file || !g.FileReader) return;
      const reader = new g.FileReader();
      reader.onload = () => setCsvText(String(reader.result ?? ''));
      reader.readAsText(file);
    };
    input.click();
  };

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
          csvText={csvText}
          setCsvText={setCsvText}
          onScan={scanContacts}
          onPreview={() => runPreview({ csv: csvText })}
          onPickFile={pickCsvFile}
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
            setCsvText('');
            setSummary(null);
            setError(null);
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
  csvText,
  setCsvText,
  onScan,
  onPreview,
  onPickFile,
  busy,
  error,
}: {
  csvText: string;
  setCsvText: (v: string) => void;
  onScan: () => void;
  onPreview: () => void;
  onPickFile: () => void;
  busy: boolean;
  error: string | null;
}) {
  const isWeb = Platform.OS === 'web';
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32, gap: 20 }}>
      {!isWeb ? (
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

      <View className="gap-2">
        <TextField
          label="Paste a CSV"
          value={csvText}
          onChangeText={setCsvText}
          placeholder={CSV_PLACEHOLDER}
          multiline
          numberOfLines={6}
          style={{ minHeight: 132, textAlignVertical: 'top' }}
          autoCapitalize="none"
          autoCorrect={false}
          hint="Columns: name, relationship, date of birth, phone. Dates like 1994-03-05, 05/03/1994, or 5 June work."
        />
        {isWeb ? (
          <Button variant="secondary" leftIcon={FileUp} onPress={onPickFile}>
            Choose a CSV file
          </Button>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" className="text-danger-fg">
          {error}
        </Text>
      ) : null}

      <Button fullWidth loading={busy} disabled={!csvText.trim()} onPress={onPreview}>
        Preview import
      </Button>
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
              <RowLine key={r.id} name={r.name} sub={formatDob(r.dob!)} />
            ))}
          </Section>
        ) : null}

        {duplicates.length > 0 ? (
          <Section label={`Possible duplicates · ${duplicates.length}`}>
            <Text variant="caption" className="mb-1 text-ink-muted">
              We found these already saved. Choose what to do — nothing is merged without you.
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
