import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { getDeptBlockRules, createDeptBlockRule, deleteDeptBlockRule } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function DeptBlockRulesPage() {
  const queryClient = useQueryClient();
  const [deptId, setDeptId] = useState('');
  const [startBlock, setStartBlock] = useState('');
  const [endBlock, setEndBlock] = useState('');

  const { data: rules, isLoading } = useQuery({
    queryKey: ['dept-block-rules'],
    queryFn: getDeptBlockRules,
  });

  const createMutation = useMutation({
    mutationFn: createDeptBlockRule,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['dept-block-rules'] });
      setDeptId('');
      setStartBlock('');
      setEndBlock('');
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDeptBlockRule,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['dept-block-rules'] });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptId.trim() || !startBlock || !endBlock) {
      toast.error('Please fill in all fields');
      return;
    }
    const start = parseInt(startBlock, 10);
    const end = parseInt(endBlock, 10);
    if (isNaN(start) || isNaN(end) || start > end || start < 1) {
      toast.error('Invalid block range');
      return;
    }
    createMutation.mutate({ dept_id: deptId.trim(), start_block: start, end_block: end });
  };

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 md:p-8">
        <span className="hero-badge">Department Block Rules</span>
        <h1 className="mt-4 section-title text-3xl md:text-4xl">Manage Block Restrictions</h1>
        <p className="section-copy">
          Define block ranges for specific departments. Junior Supervisors from a department will not be assigned to its restricted blocks.
        </p>

        <form onSubmit={handleAddRule} className="mt-8 flex flex-wrap items-end gap-4 p-5 glass-panel">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-semibold text-foreground">Department ID</label>
            <Input
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              placeholder="e.g. ENTC"
              className="mt-2"
            />
          </div>
          <div className="w-[120px]">
            <label className="text-sm font-semibold text-foreground">Start Block</label>
            <Input
              type="number"
              min="1"
              value={startBlock}
              onChange={(e) => setStartBlock(e.target.value)}
              placeholder="1"
              className="mt-2"
            />
          </div>
          <div className="w-[120px]">
            <label className="text-sm font-semibold text-foreground">End Block</label>
            <Input
              type="number"
              min="1"
              value={endBlock}
              onChange={(e) => setEndBlock(e.target.value)}
              placeholder="10"
              className="mt-2"
            />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        </form>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-white/35 px-6 py-5">
          <h2 className="text-lg font-bold text-foreground">Active Rules</h2>
          <p className="mt-2 text-sm text-muted-foreground">List of current block restrictions per department.</p>
        </div>

        <div className="overflow-x-auto px-2 pb-2">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading rules...</div>
          ) : rules && rules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Start Block</TableHead>
                  <TableHead>End Block</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.rule_id} className="border-white/30">
                    <TableCell className="font-semibold">{rule.dept_id}</TableCell>
                    <TableCell>{rule.start_block}</TableCell>
                    <TableCell>{rule.end_block}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(rule.rule_id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">No rules defined.</div>
          )}
        </div>
      </section>
    </div>
  );
}
