import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileSpreadsheet, Search, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { getFaculties, toggleFacultyLeave, uploadFacultyFile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [searchQuery, setSearchQuery] = useState('');

  const facultiesQuery = useQuery({
    queryKey: ['faculties'],
    queryFn: getFaculties,
  });

  const toggleLeaveMutation = useMutation({
    mutationFn: ({ facultyId, isOnLeave }: { facultyId: number; isOnLeave: boolean }) =>
      toggleFacultyLeave(facultyId, isOnLeave),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['faculties'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(result.message);
    },
    onError: (error: Error) => toast.error(error.message),
  });

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

  const facultiesData = Array.isArray(facultiesQuery.data) ? facultiesQuery.data : [];
  const filteredFaculties = facultiesData.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.dept_id.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 md:p-8">
        <span className="hero-badge">Faculty Management</span>
        <h1 className="mt-4 section-title text-3xl md:text-4xl">Keep faculty records accurate before every exam duty cycle.</h1>
        <p className="section-copy">
          Upload the latest faculty sheet so the examination department can work with current department, qualification, and leave information while preparing duty assignments.
        </p>

        <div
          className={`mt-8 rounded-[28px] border-2 border-dashed p-8 text-center transition-all md:p-12 ${dragActive ? 'border-primary bg-white/55 shadow-[0_22px_50px_rgba(44,101,133,0.14)]' : 'border-white/60 bg-white/32'}`}
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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary/12 text-primary">
            <Upload className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-xl font-bold text-foreground">Upload faculty list</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Drop the Excel file here or click to browse. The sheet should include faculty name, department, designation, qualification, joining date, and leave status.
          </p>
          <input
            id="faculty-file-input"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </div>

        {mutation.isPending && (
          <div className="mt-4 rounded-2xl border border-white/50 bg-white/36 px-4 py-3 text-sm text-muted-foreground backdrop-blur-md">
            Updating faculty records...
          </div>
        )}
      </section>

      {uploadResult && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="metric-card">
              <p className="text-sm font-semibold text-muted-foreground">Records Updated</p>
              <p className="mt-4 text-4xl font-extrabold text-foreground">{uploadResult.total_records}</p>
            </div>
            <div className="metric-card">
              <p className="text-sm font-semibold text-muted-foreground">File Type</p>
              <p className="mt-4 text-2xl font-extrabold text-foreground">Faculty Master</p>
            </div>
            <div className="metric-card">
              <p className="text-sm font-semibold text-muted-foreground">Status</p>
              <p className="mt-4 text-2xl font-extrabold text-foreground">Ready for Allocation</p>
            </div>
          </section>

          <section className="glass-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/35 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Faculty Preview</h2>
                  <p className="text-sm text-muted-foreground">Review a sample of the updated faculty records.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setUploadResult(null)}>
                <X className="mr-1 h-4 w-4" />
                Close Preview
              </Button>
            </div>

            <div className="overflow-x-auto overflow-y-auto px-2 pb-2 max-h-[560px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role Type</TableHead>
                    <TableHead>Qualification</TableHead>
                    <TableHead>Date of Joining</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Leave Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadResult.preview.map((faculty) => (
                    <TableRow key={faculty.employee_code} className="border-white/30">
                      <TableCell className="font-mono text-xs">{faculty.employee_code}</TableCell>
                      <TableCell className="font-semibold">{faculty.name}</TableCell>
                      <TableCell>{faculty.gender}</TableCell>
                      <TableCell>{faculty.dept_id}</TableCell>
                      <TableCell>
                        <Badge variant={faculty.teaching_type === 'T' ? 'default' : 'secondary'}>
                          {faculty.teaching_type === 'T' ? 'Teaching' : 'Non-Teaching'}
                        </Badge>
                      </TableCell>
                      <TableCell>{faculty.qualification}</TableCell>
                      <TableCell>{faculty.date_of_joining || 'N/A'}</TableCell>
                      <TableCell>{faculty.experience_years} yrs</TableCell>
                      <TableCell>
                        {faculty.is_on_leave ? <X className="h-4 w-4 text-destructive" /> : <Check className="h-4 w-4 text-success" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}

      <section className="glass-card overflow-hidden mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/35 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-foreground">Faculty Leave Management</h2>
            <p className="text-sm text-muted-foreground">Search and manage leave status for all faculty records.</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or department..."
              className="pl-9 bg-white/40 border-white/55"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {facultiesQuery.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading faculties...</div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto px-2 pb-2 max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>On Leave</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFaculties.map((faculty) => (
                  <TableRow key={faculty.faculty_id} className="border-white/30">
                    <TableCell className="font-mono text-xs">{faculty.employee_code}</TableCell>
                    <TableCell className="font-semibold">{faculty.name}</TableCell>
                    <TableCell>{faculty.dept_id}</TableCell>
                    <TableCell>{faculty.designation}</TableCell>
                    <TableCell>{faculty.experience_years} yrs</TableCell>
                    <TableCell>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={faculty.is_on_leave}
                          onChange={(e) => toggleLeaveMutation.mutate({ facultyId: faculty.faculty_id, isOnLeave: e.target.checked })}
                          className="h-4 w-4 rounded border-white/60 bg-white/40 text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium">{faculty.is_on_leave ? 'Yes' : 'No'}</span>
                      </label>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredFaculties.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No faculty found matching your search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
