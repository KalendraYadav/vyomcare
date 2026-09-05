'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { complianceApi, getErrorMessage } from '@/lib/api';
import { ComplianceRule } from '@/types/models';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { CategoryBadge } from '@/components/shared/CategoryBadge';
import { ShieldCheck, Clock, Loader2 } from 'lucide-react';

interface EditComplianceRuleDialogProps {
  rule: ComplianceRule | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function EditComplianceRuleDialog({
  rule,
  isOpen,
  onClose,
  onUpdated,
}: EditComplianceRuleDialogProps) {
  const queryClient = useQueryClient();
  const [hours, setHours] = React.useState<number>(48);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (rule) {
      setHours(rule.maxDurationHours);
      setErrorMessage(null);
    }
  }, [rule]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!rule) throw new Error('No rule selected');
      if (hours <= 0 || !Number.isInteger(hours)) {
        throw new Error('Please enter a valid positive integer for max duration hours.');
      }
      return complianceApi.update(rule.id, hours);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-rules'] });
      if (onUpdated) onUpdated();
      onClose();
    },
    onError: (err) => {
      setErrorMessage(getErrorMessage(err));
    },
  });

  if (!rule) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        if (!updateMutation.isPending) onClose();
      }}
      title="Configure Statutory SLA Threshold"
      description="Update CPCB regulatory maximum duration limits for biomedical waste custody stages."
      maxWidth="md"
    >
      <div className="space-y-4 py-1">
        {/* Category and Stage Preview */}
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-neutral-400">
              Waste Category
            </span>
            {rule.wasteCategory && (
              <CategoryBadge category={rule.wasteCategory} size="sm" />
            )}
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-200/60">
            <span className="text-neutral-500 font-semibold">Custody Stage:</span>
            <span className="font-bold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded">
              {rule.stage}
            </span>
          </div>
        </div>

        {/* Error notice */}
        {errorMessage && (
          <Alert variant="danger" title="Update Failed" onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        {/* Input Form */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-neutral-500" />
              <span>Maximum Duration (Hours)</span>
            </span>
            <span className="text-[11px] font-normal text-neutral-400">
              Threshold triggering automated alert
            </span>
          </label>

          <Input
            type="number"
            min={1}
            max={168}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="font-bold text-sm"
            required
          />

          <p className="text-[11px] text-neutral-500 leading-normal">
            CPCB 2016 Bio-medical Waste Management statutory baseline is <strong>48 hours</strong> for hazardous waste transport to avoid microbial proliferation.
          </p>
        </div>

        {/* Pre-fill Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold text-neutral-400 uppercase mr-1">
            Common Baselines:
          </span>
          {[24, 48, 72].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setHours(preset)}
              className={`text-xs px-2.5 py-1 rounded-md border font-semibold transition-colors ${
                hours === preset
                  ? 'bg-primary-subtle border-primary text-primary'
                  : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {preset} Hours
            </button>
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => updateMutation.mutate()}
            isLoading={updateMutation.isPending}
            disabled={updateMutation.isPending || hours <= 0}
            className="gap-1.5 font-semibold"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Save SLA Threshold</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
