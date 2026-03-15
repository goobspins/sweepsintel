import type { ReactNode } from 'react';

import type { SessionUser } from '../../lib/auth';
import OTPForm from './OTPForm';

interface SessionGateProps {
  user: SessionUser | null;
  children: ReactNode;
  redirectTo?: string;
  title?: string;
  description?: string;
}

export default function SessionGate({
  user,
  children,
  redirectTo,
  title,
  description,
}: SessionGateProps) {
  if (!user) {
    return (
      <OTPForm
        redirectTo={redirectTo}
        title={title}
        description={description}
      />
    );
  }

  return <>{children}</>;
}

