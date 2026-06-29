import { Badge, HStack, Wrap } from '@chakra-ui/react';
import type { PipelineReport } from '../api';

// The objective three-tier report as colour-coded badges, straight from the
// server. tsc + v2-smell + composition are the trusted gates; render is the
// runtime tier. We distinguish "generated clean" (tscOkSingleShot) from
// "self-healed" (tscOk after repairIters) so the result stays honest.
export function ReportBadges({ report }: { report: PipelineReport }) {
  const tscPalette = report.tscOk ? 'green' : 'red';
  const tscLabel = report.tscOk
    ? report.repairIters === 0
      ? 'tsc ✓ (clean first try)'
      : `tsc ✓ (self-healed ×${report.repairIters})`
    : `tsc ✗ (${report.tscErrors} errors)`;

  return (
    <Wrap gap={2}>
      <Badge colorPalette={tscPalette} variant="solid" px={2} py={1}>
        {tscLabel}
      </Badge>

      <Badge colorPalette={report.tscOkSingleShot ? 'green' : 'gray'} variant="subtle" px={2} py={1}>
        {report.tscOkSingleShot ? 'generated clean' : 'needed repair'}
      </Badge>

      <Badge colorPalette={report.smells.length ? 'orange' : 'green'} variant="subtle" px={2} py={1}>
        {report.smells.length ? `v2-smells: ${report.smells.length}` : 'no v2 smells'}
      </Badge>

      {report.smellRepairIters > 0 && (
        <Badge colorPalette="green" variant="subtle" px={2} py={1}>
          v2 smell auto-fixed
        </Badge>
      )}

      <Badge
        colorPalette={report.incomplete.length ? 'orange' : 'green'}
        variant="subtle"
        px={2}
        py={1}
      >
        {report.incomplete.length ? 'composition incomplete' : 'composition complete'}
      </Badge>

      <Badge colorPalette={report.renderOk ? 'green' : 'red'} variant="subtle" px={2} py={1}>
        {report.renderOk ? 'renders ✓' : 'render ✗'}
      </Badge>

      <Badge colorPalette={report.grounded ? 'teal' : 'gray'} variant="outline" px={2} py={1}>
        {report.grounded ? 'grounded' : 'ungrounded'}
      </Badge>
    </Wrap>
  );
}

// Detail lines for smells / incomplete composition, shown under the badges when
// present so a user can see exactly what the objective gates flagged.
export function ReportDetails({ report }: { report: PipelineReport }) {
  if (!report.smells.length && !report.incomplete.length) return null;
  return (
    <HStack gap={6} mt={2} fontSize="sm" color="fg.muted" wrap="wrap">
      {report.smells.length > 0 && <span>v2 smells: {report.smells.join(', ')}</span>}
      {report.incomplete.length > 0 && <span>incomplete: {report.incomplete.join(', ')}</span>}
    </HStack>
  );
}
