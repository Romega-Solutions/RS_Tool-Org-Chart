"use client";
import { apiPath } from "@/lib/paths";

import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Download } from "lucide-react";

interface CsvRow {
  name: string;
  title: string;
  department: string;
  reports_to_name: string;
  photo_filename: string;
}

interface ImportResult {
  row: number;
  name: string;
  status: "created" | "updated" | "error";
  message?: string;
}

interface CsvImportProps {
  compact?: boolean;
  onComplete?: () => void;
}

export function CsvImport({ compact = false, onComplete }: CsvImportProps = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setResults(null);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { data, errors } = Papa.parse<CsvRow>(text, {
        header: true,
        skipEmptyLines: true,
      });

      if (errors.length > 0) {
        setParseError(
          errors.map((err) => `Row ${err.row}: ${err.message}`).join("; ")
        );
        setRows([]);
        return;
      }

      setRows(data);
    };
    reader.readAsText(selectedFile);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".csv")) {
      processFile(droppedFile);
    } else {
      setParseError("Please drop a CSV file.");
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleImport() {
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(apiPath("/api/import"), { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setParseError(data.error || "Import failed");
        return;
      }

      setResults(data.results);
      onComplete?.();
    } catch {
      setParseError("Network error during import.");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setFile(null);
    setRows([]);
    setResults(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const createdCount = results?.filter((r) => r.status === "created").length ?? 0;
  const updatedCount = results?.filter((r) => r.status === "updated").length ?? 0;
  const errorCount = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <div className={`space-y-6 ${compact ? "" : "max-w-3xl"}`}>
      {!compact && (
        <div>
          <h1 className="text-xl font-bold">Import People</h1>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file to bulk-import or update people in the org chart.
          </p>
        </div>
      )}

      {/* Template download */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Not sure about the format?</p>
          <p className="text-xs text-muted-foreground">Download the template CSV with the correct columns and sample data.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 cursor-pointer transition-all duration-200"
          onClick={() => {
            const template = "name,title,department,reports_to_name,photo_filename\nRobbie Galoso,Founder,Executive,,robbie.jpg\nCherry Ann Reyes,Chief of Staff,Executive,Robbie Galoso,cherry.jpg\nKen Garcia,Full Stack Developer,Technical,Robbie Galoso,ken.jpg\nMark Siazon,Product Designer,Technical,Robbie Galoso,mark.jpg\n";
            const blob = new Blob([template], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "org-chart-import-template.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          Download Template
        </Button>
      </div>

      {/* Drop zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload CSV</CardTitle>
          <CardDescription>
            Columns: name, title, department, reports_to_name, photo_filename
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
              dragOver
                ? "border-rs-primary-400 bg-rs-primary-500/5 shadow-sm"
                : "border-border hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-10 h-10 text-rs-primary-400" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {rows.length} row{rows.length !== 1 ? "s" : ""} parsed
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-muted-foreground" />
                <p className="font-medium">
                  Drag &amp; drop a CSV file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Only .csv files are accepted
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Parse error */}
      {parseError && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && !results && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Review the data before importing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Reports To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{row.name || <span className="text-destructive italic">empty</span>}</TableCell>
                    <TableCell>{row.title || <span className="text-muted-foreground italic">--</span>}</TableCell>
                    <TableCell>{row.department || <span className="text-muted-foreground italic">--</span>}</TableCell>
                    <TableCell>{row.reports_to_name || <span className="text-muted-foreground italic">--</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Import button */}
      {rows.length > 0 && !results && (
        <div className="flex gap-3">
          <Button onClick={handleImport} disabled={importing} className="cursor-pointer transition-all duration-200">
            <Upload className="w-4 h-4 mr-2" />
            {importing ? "Importing..." : `Import ${rows.length} row${rows.length !== 1 ? "s" : ""}`}
          </Button>
          <Button variant="outline" onClick={handleReset} className="cursor-pointer transition-all duration-200">
            Cancel
          </Button>
        </div>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
            <CardDescription>
              {createdCount} created, {updatedCount} updated, {errorCount} error{errorCount !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.row}>
                    <TableCell className="text-muted-foreground">{result.row}</TableCell>
                    <TableCell className="font-medium">{result.name}</TableCell>
                    <TableCell>
                      {result.status === "created" && (
                        <Badge variant="default" className="bg-green-600/20 text-green-400 border-green-600/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" />Created
                        </Badge>
                      )}
                      {result.status === "updated" && (
                        <Badge variant="secondary">
                          <CheckCircle2 className="w-3 h-3 mr-1" />Updated
                        </Badge>
                      )}
                      {result.status === "error" && (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />Error
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {result.message || "--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset} className="cursor-pointer transition-all duration-200">
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
