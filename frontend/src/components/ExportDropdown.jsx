'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileDown, FileText, ChevronDown, Loader2 } from 'lucide-react';
import { exportToPDF, exportToDOCX, exportToDOC } from '@/lib/exportReport';

/**
 * Export dropdown button for reports
 * @param {Object} report - The report object to export
 */
export function ExportDropdown({ report }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState(null);

  const handleExport = async (type) => {
    setIsExporting(true);
    setExportType(type);

    try {
      const filename = report.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      switch (type) {
        case 'pdf':
          await exportToPDF(report, filename);
          break;
        case 'docx':
          await exportToDOCX(report, filename);
          break;
        case 'doc':
          await exportToDOC(report, filename);
          break;
      }
    } catch (err) {
      console.error(`${type.toUpperCase()} export error:`, err);
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 shadow-sm"
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {isExporting ? `Exporting ${exportType?.toUpperCase()}...` : 'Export'}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onClick={() => handleExport('pdf')}
          className="gap-3 cursor-pointer"
          disabled={isExporting}
        >
          <FileDown className="h-4 w-4 text-red-500" />
          <span>Export as PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('docx')}
          className="gap-3 cursor-pointer"
          disabled={isExporting}
        >
          <FileText className="h-4 w-4 text-blue-500" />
          <span>Export as DOCX</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('doc')}
          className="gap-3 cursor-pointer"
          disabled={isExporting}
        >
          <FileText className="h-4 w-4 text-blue-700" />
          <span>Export as DOC</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportDropdown;
