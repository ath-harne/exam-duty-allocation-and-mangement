import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Faculty = {
  faculty_id: number;
  faculty_name: string;
  employee_code: string;
  dept_id: string;
};

export function FacultySwapCombobox({
  currentFacultyId,
  currentFacultyName,
  availableFaculties,
  onSwap,
}: {
  currentFacultyId: number;
  currentFacultyName: string;
  availableFaculties: Faculty[];
  onSwap: (newFacultyId: number) => void;
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {currentFacultyName}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search faculty..." />
          <CommandList>
            <CommandEmpty>No available faculty found.</CommandEmpty>
            <CommandGroup heading="Available Faculties">
              {availableFaculties.map((faculty) => (
                <CommandItem
                  key={faculty.faculty_id}
                  value={faculty.faculty_id.toString()}
                  keywords={[faculty.employee_code, faculty.faculty_name, faculty.dept_id]}
                  onSelect={() => {
                    onSwap(faculty.faculty_id);
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentFacultyId === faculty.faculty_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col text-sm">
                    <span className="font-semibold">{faculty.faculty_name}</span>
                    <span className="text-xs text-muted-foreground">{faculty.employee_code} - {faculty.dept_id}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
