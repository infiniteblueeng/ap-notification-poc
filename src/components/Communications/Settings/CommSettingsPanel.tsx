import { Section } from 'components';
import Settings from './Settings'; // adjust path to where your Settings file lives
import type { Toast } from 'hooks/useToasts';

type Props = {
  pushToast: (t: Omit<Toast, 'id'>) => string;
  refresh?: () => Promise<unknown>;
  onSaved?: () => void;
};

export default function CommsSettingsPanel({ pushToast, refresh, onSaved }: Props) {
  return (
    <Section
      title="Settings"
      description="Configure Everbridge credentials for Communications. Secret/password are never prefilled.">
      <Settings
        pushToast={pushToast}
        refresh={refresh}
        // instead of closing a modal, just call onSaved
        onClose={onSaved}
      />
    </Section>
  );
}
