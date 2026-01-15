'use client';

import { SetupWizard } from '@/components/wizard/SetupWizard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

/**
 * New Project Button with Setup Wizard
 * This is a client component that wraps the wizard functionality
 */
export function NewProjectButton() {
  return (
    <SetupWizard
      trigger={
        <Button className="gap-2 rounded-xl shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      }
    />
  );
}

export default NewProjectButton;
