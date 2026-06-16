import React, { useEffect, useState } from 'react';
import type { Toast } from 'hooks/useToasts';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Field } from 'components';
import { useEverbridgeSettingsRow } from 'hooks/useEverbridgeSettingsRow';
import { useQueryClient } from '@tanstack/react-query';

type Props = {
  pushToast: (t: Omit<Toast, 'id'>) => string;
  onClose?: () => void;
  refresh?: () => Promise<unknown>; // token refetch
};

type FormState = {
  eb_client_id: string;
  eb_client_secret: string;
  eb_username: string;
  eb_user_password: string;
  eb_role_id: string;
};

export default function Settings({ pushToast, onClose, refresh }: Props) {
  const queryClient = useQueryClient();
  const settingsQuery = useEverbridgeSettingsRow();
  const row = settingsQuery.data;

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>({
    eb_client_id: '',
    eb_client_secret: '',
    eb_username: '',
    eb_user_password: '',
    eb_role_id: '',
  });

  // Initialize form from row (but do NOT prefill secret/password)
  useEffect(() => {
    if (!row) return;
    setForm({
      eb_client_id: row.eb_client_id ?? '',
      eb_client_secret: '',
      eb_username: row.eb_username ?? '',
      eb_user_password: '',
      eb_role_id: row.eb_role_id ?? '',
    });
  }, [row]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function handleSave() {
    const updates: Partial<FormState> = {};
    (Object.keys(form) as Array<keyof FormState>).forEach((k) => {
      const v = form[k];
      if (v && v.trim() !== '') updates[k] = v;
    });

    if (!Object.keys(updates).length) {
      pushToast({ type: 'error', title: 'Nothing to save', message: 'Please update at least one field.' });
      return;
    }

    const writeId = row?.id ?? 1;

    setLoading(true);
    try {
      await new Promise((resolve, reject) => {
        try {
          //@ts-expect-error rbf_updateRecord is global
          rbf_updateRecord('$SETTINGS', writeId, updates, true, (data: any) => resolve(data));
        } catch (err) {
          reject(err);
        }
      });

      pushToast({ type: 'success', title: 'Settings saved', message: 'Everbridge settings updated successfully.', ttl: 2500 });

      // IMPORTANT: refresh cached settings row so token hook can re-enable if creds were missing
      await queryClient.invalidateQueries({ queryKey: ['everbridgeSettingsRow'] });
      await queryClient.invalidateQueries({ queryKey: ['everbridgeToken'] });

      // optional explicit token refresh if you still want it
      if (refresh) {
        try {
          await refresh();
        } catch {}
      }

      onClose?.();
    } catch (err: any) {
      pushToast({ type: 'error', title: 'Save failed', message: err?.message ?? 'Unable to save settings.' });
    } finally {
      setLoading(false);
    }
  }

  if (settingsQuery.isLoading) return <div className="p-4 text-sm text-zinc-500">Loading settings…</div>;

  return (
    <form
      className="bg-white rounded p-4"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Client ID" required>
          <Input value={form.eb_client_id} onChange={(e) => updateField('eb_client_id', e.target.value)} placeholder="Client ID" />
        </Field>

        <Field label="Client Secret">
          <Input type="password" value={form.eb_client_secret} onChange={(e) => updateField('eb_client_secret', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </Field>

        <Field label="Username" required>
          <Input value={form.eb_username} onChange={(e) => updateField('eb_username', e.target.value)} placeholder="Username" autoComplete="username" />
        </Field>

        <Field label="Password">
          <Input type="password" value={form.eb_user_password} onChange={(e) => updateField('eb_user_password', e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </Field>

        <Field label="Role ID" required>
          <Input value={form.eb_role_id} onChange={(e) => updateField('eb_role_id', e.target.value)} placeholder="Role ID" />
        </Field>
      </div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save Settings'}
        </Button>
        {/* <Button type="button" onClick={() => onClose?.()} variant="secondary">
          Cancel
        </Button> */}
      </div>
    </form>
  );
}
