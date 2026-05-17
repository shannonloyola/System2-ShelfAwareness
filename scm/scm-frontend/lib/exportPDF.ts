import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const A4_WIDTH = 297; // mm (landscape)
const A4_HEIGHT = 210; // mm

export const exportDashboardToPDF = async (roleName: string) => {
  try {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // PAGE 1: COVER PAGE
    pdf.setFillColor(13, 27, 42); // #0D1B2A
    pdf.rect(0, 0, A4_WIDTH, A4_HEIGHT, 'F');
    
    // Watermark
    pdf.setTextColor(255, 255, 255);
    pdf.setGState(new (pdf as any).GState({ opacity: 0.05 }));
    pdf.setFontSize(80);
    pdf.text("CONFIDENTIAL", A4_WIDTH / 2, A4_HEIGHT / 2, { align: 'center', angle: -30 });
    pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

    // Cover Text
    pdf.setFontSize(36);
    pdf.setFont("helvetica", "bold");
    pdf.text("SHELF AWARENESS", A4_WIDTH / 2, A4_HEIGHT / 2 - 20, { align: 'center' });
    
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "normal");
    pdf.text("Medical Logistics Intelligence Report", A4_WIDTH / 2, A4_HEIGHT / 2, { align: 'center' });
    
    pdf.setFontSize(14);
    pdf.setTextColor(0, 163, 173); // Teal
    pdf.text(`${roleName} View`, A4_WIDTH / 2, A4_HEIGHT / 2 + 20, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setTextColor(136, 153, 170); // #8899AA
    pdf.text(`Period: Last 30 Days`, A4_WIDTH / 2, A4_HEIGHT / 2 + 35, { align: 'center' });
    pdf.text(`Generated: ${new Date().toLocaleString()}`, A4_WIDTH / 2, A4_HEIGHT / 2 + 45, { align: 'center' });

    // PAGE 2: KPI SUMMARY
    const kpiElement = document.getElementById('kpi-scorecard-bar');
    if (kpiElement) {
      pdf.addPage();
      pdf.setFillColor(13, 27, 42);
      pdf.rect(0, 0, A4_WIDTH, A4_HEIGHT, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.text("KPI Summary", 20, 20);

      const kpiCanvas = await html2canvas(kpiElement, { scale: 2, backgroundColor: '#0D1B2A' });
      const imgData = kpiCanvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = A4_WIDTH - 40;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 20, 40, pdfWidth, pdfHeight);
    }

    // PAGES 3+: CHARTS
    const panels = Array.from(document.querySelectorAll('.panel-wrapper')) as HTMLElement[];
    
    for (let i = 0; i < panels.length; i += 2) {
      pdf.addPage();
      pdf.setFillColor(13, 27, 42);
      pdf.rect(0, 0, A4_WIDTH, A4_HEIGHT, 'F');
      
      // Top Header
      pdf.setTextColor(0, 163, 173);
      pdf.setFontSize(10);
      pdf.text("Shelf Awareness | Executive Report", 15, 15);
      
      // First Panel on this page
      const panel1 = panels[i];
      if (panel1) {
        const title1 = panel1.getAttribute('data-panel-title') || 'Chart';
        const canvas1 = await html2canvas(panel1, { scale: 2, backgroundColor: '#0D1B2A' });
        const imgData1 = canvas1.toDataURL('image/png');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.text(title1, 15, 30);
        
        pdf.addImage(imgData1, 'PNG', 15, 40, (A4_WIDTH/2) - 25, 120);
      }

      // Second Panel on this page
      const panel2 = panels[i+1];
      if (panel2) {
        const title2 = panel2.getAttribute('data-panel-title') || 'Chart';
        const canvas2 = await html2canvas(panel2, { scale: 2, backgroundColor: '#0D1B2A' });
        const imgData2 = canvas2.toDataURL('image/png');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(14);
        pdf.text(title2, A4_WIDTH/2 + 10, 30);
        
        pdf.addImage(imgData2, 'PNG', A4_WIDTH/2 + 10, 40, (A4_WIDTH/2) - 25, 120);
      }
    }

    pdf.save(`Shelf_Awareness_${roleName}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
