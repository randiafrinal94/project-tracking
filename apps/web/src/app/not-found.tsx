import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface">
      <EmptyState
        icon="travel_explore"
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <ButtonLink href="/" variant="primary">
            Back to dashboard
          </ButtonLink>
        }
      />
    </main>
  );
}
