import { FoundationDesignResult, MathStep } from '@/lib/structural/foundation';

export function generateFoundationPdfReport(result: FoundationDesignResult): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const stepsHtml = result.mathSteps
    .map(
      (step: MathStep, idx: number) => `
      <div style="margin-bottom: 15px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #f8fafc;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; color: #0f172a;">
          <span>${idx + 1}. ${step.title}</span>
          <span style="color: ${step.status === 'PASS' ? '#16a34a' : '#dc2626'};">[${step.status}] ${step.clauseRef}</span>
        </div>
        <div style="font-family: monospace; font-size: 11px; margin-top: 6px; color: #334155;">
          <div><strong>Formula:</strong> ${step.formulaSymbolic}</div>
          <div><strong>Substitution:</strong> ${step.formulaSubstituted}</div>
          <div style="margin-top: 4px; font-size: 12px; color: #0284c7;">
            <strong>Calculated Result:</strong> ${step.resultValue} ${step.unit}
            ${step.limitValue ? ` (Limit: ${step.limitValue} ${step.unit} | DCR: ${step.dcr})` : ''}
          </div>
        </div>
      </div>`
    )
    .join('');

  const bbsHtml = result.bbs
    .map(
      (b) => `
      <tr>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${b.mark}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${b.description}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">Ø${b.barDiameter}mm</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${b.spacing}mm</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${b.count}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">${b.cutLength}m</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; font-weight: bold;">${b.totalWeight}kg</td>
      </tr>`
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Structural Calculation Sheet - ${result.typeLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #0f172a; line-height: 1.4; }
          h1 { font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #0284c7; padding-bottom: 6px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .card { padding: 10px; background: #f1f5f9; border-radius: 4px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
          th { background: #0284c7; color: white; padding: 6px; text-align: left; }
        </style>
      </head>
      <body>
        <h1>HAYA STRUCTURES — AUTOMATED CALCULATION REPORT</h1>
        <div class="grid">
          <div class="card">
            <strong>Design Code:</strong> ${result.codeUsed}<br/>
            <strong>Structure Type:</strong> ${result.typeLabel}<br/>
            <strong>Status:</strong> <span style="color: green; font-weight: bold;">${result.status}</span>
          </div>
          <div class="card">
            <strong>Optimized Plan (B x L):</strong> ${result.geometry.B} x ${result.geometry.L} mm<br/>
            <strong>Total Thickness (D):</strong> ${result.geometry.D} mm<br/>
            <strong>Concrete Vol / Steel Wt:</strong> ${result.concreteVolumeM3} m³ / ${result.totalSteelWeightKg} kg
          </div>
        </div>

        <h2 style="font-size: 14px; border-bottom: 1px solid #94a3b8; padding-bottom: 4px;">1. MATHEMATICAL WORKFLOW & CALCULATIONS</h2>
        ${stepsHtml}

        <h2 style="font-size: 14px; border-bottom: 1px solid #94a3b8; padding-bottom: 4px; margin-top: 25px;">2. BAR BENDING SCHEDULE (BBS TAKEOFF)</h2>
        <table>
          <thead>
            <tr>
              <th>Mark</th>
              <th>Description</th>
              <th>Size</th>
              <th>Spacing</th>
              <th>Qty</th>
              <th>Cut Length</th>
              <th>Total Weight</th>
            </tr>
          </thead>
          <tbody>
            ${bbsHtml}
          </tbody>
        </table>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}