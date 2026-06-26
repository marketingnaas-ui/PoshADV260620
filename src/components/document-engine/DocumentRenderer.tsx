import React from 'react';
import { PublishedTemplate } from './useDocumentTemplates';
import { AdvanceTemplateRenderer } from './AdvanceTemplateRenderer';
import { ClearanceTemplateRenderer } from './ClearanceTemplateRenderer';
import { SummaryReportTemplateRenderer } from './SummaryReportTemplateRenderer';
import { StudioTemplateRenderer } from './StudioTemplateRenderer';

interface DocumentRendererProps {
  template?: PublishedTemplate;
  data: any;
}

export const DocumentRenderer: React.FC<DocumentRendererProps> = ({ template, data }) => {
  if (!template) {
    return (
      <div className="bg-white text-slate-400 p-8 rounded-xl border border-dashed border-slate-200 text-center text-xs font-mono">
        [Error: Template is not loaded or published yet.]
      </div>
    );
  }

  // If the template has studio config (v2 schema), use the studio renderer
  if (template.studioConfig || template.config?.elements) {
    return <StudioTemplateRenderer template={template} data={data} />;
  }

  const kind = template.kind;
  const id = template.id;

  if (kind === 'advance' || id === 'TPL1') {
    return <AdvanceTemplateRenderer template={template} data={data} />;
  }

  if (kind === 'clearance' || id === 'TPL2') {
    return <ClearanceTemplateRenderer template={template} data={data} />;
  }

  if (kind === 'summaryReport' || id === 'TPL3') {
    return <SummaryReportTemplateRenderer template={template} data={data} />;
  }

  // Fallback if template is legacy / unrecognized
  return (
    <div className="bg-white text-rose-500 p-8 rounded-xl border border-red-200 text-center text-xs font-mono font-bold">
      [Error: Unsupported template kind or missing template ID: {id} / {kind}]
    </div>
  );
};

export default DocumentRenderer;
