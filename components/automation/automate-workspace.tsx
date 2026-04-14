"use client";

import { AutomationEditor } from "@/components/automation/automation-editor";
import { RulesSummaryCard, type RuleSummaryListItem } from "@/components/rules/rules-summary-card";

type FilterOption = { id: number; name: string };

type AutomateWorkspaceProps = {
  filters: FilterOption[];
  rulesForSummary: RuleSummaryListItem[];
};

export function AutomateWorkspace({ filters, rulesForSummary }: AutomateWorkspaceProps) {
  return (
    <div className="flex flex-col gap-8">
      <div data-tutorial-target="tutoriel-automate-editeur">
        <AutomationEditor filters={filters} variant="page" />
      </div>

      <div data-tutorial-target="tutoriel-automate-regles">
        <RulesSummaryCard rules={rulesForSummary} emphasis="actions" filters={filters} />
      </div>
    </div>
  );
}
