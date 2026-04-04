import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, FileSpreadsheet, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFacultyFile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FacultyUploadResponse } from '@/types/exam';

export default function FacultyUploadPage() {
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<FacultyUploadResponse | null>(null);

  const mutation = useMutation({
    mutationFn: uploadFacultyFile,
    onSuccess: (result) => {
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please upload a valid Excel file.');
      return;
    }
    mutation.mutate(file);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Faculty Upload</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload the faculty master Excel to store faculty, leave status, and computed experience in MySQL.</p>
      </div>

      <div
        className={`glass-card rounded-xl p-10 border-2 border-dashed text-center transition-colors cursor-pointer ${dragActive ? 'border-primary bg-primary/5' : 'border-border'}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          handleFile(event.dataTransfer.files[0]);
        }}
        onClick={() => document.getElementById('faculty-file-input')?.click()}
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Upload className="w-7 h-7 text-primary" />
        </div>
        <p className="font-medium text-foreground">Drop the faculty Excel here or click to browse</p>
        <p className="text-sm text-muted-foreground mt-1">Expected fields: name, gender, dept, teaching_type, qualification, designation, date_of_joining, is_on_leave</p>
        <input
          id="faculty-file-input"
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </div>

      {mutation.isPending && (
        <div className="text-sm text-muted-foreground">Uploading faculty data to the backend...</div>
      )}

      {uploadResult && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <span className="font-semibold">{uploadResult.total_records} faculty rows processed</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setUploadResult(null)}>
              <X className="w-4 h-4 mr-1" /> Clear Preview
            </Button>
          </div>

          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qualification</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Leave</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadResult.preview.map((faculty) => (
                  <TableRow key={faculty.employee_code}>
                    <TableCell className="font-mono text-xs">{faculty.employee_code}</TableCell>
                    <TableCell className="font-medium">{faculty.name}</TableCell>
                    <TableCell>{faculty.gender}</TableCell>
                    <TableCell>{faculty.dept_id}</TableCell>
                    <TableCell>
                      <Badge variant={faculty.teaching_type === 'T' ? 'default' : 'secondary'}>
                        {faculty.teaching_type === 'T' ? 'Teaching' : 'Non-Teaching'}
                      </Badge>
                    </TableCell>
                    <TableCell>{faculty.qualification}</TableCell>
                    <TableCell>{faculty.experience_years} yrs</TableCell>
                    <TableCell>{faculty.is_on_leave ? <X className="w-4 h-4 text-destructive" /> : <Check className="w-4 h-4 text-success" />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
