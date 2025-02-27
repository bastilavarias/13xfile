import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Filter, MoreHorizontal, User2 } from "lucide-react"

type Task = {
  id: string
  type: "Bug" | "Feature" | "Documentation"
  title: string
  status: "In Progress" | "Backlog" | "Todo" | "Canceled" | "Done"
  priority: "High" | "Medium" | "Low"
}

const tasks: Task[] = [
  {
    id: "TASK-8782",
    type: "Documentation",
    title: "You can't compress the program without quantifying the open-source SSD..",
    status: "In Progress",
    priority: "Medium",
  },
  {
    id: "TASK-7878",
    type: "Documentation",
    title: "Try to calculate the EXE feed, maybe it will index the multi-byte pixel!",
    status: "Backlog",
    priority: "Medium",
  },
  {
    id: "TASK-7839",
    type: "Bug",
    title: "We need to bypass the neural TCP card!",
    status: "Todo",
    priority: "High",
  },
  {
    id: "TASK-5562",
    type: "Feature",
    title: "The SAS interface is down, bypass the open-source pixel so we can back ...",
    status: "Backlog",
    priority: "Medium",
  },
  {
    id: "TASK-8686",
    type: "Feature",
    title: "I'll parse the wireless SSL protocol, that should driver the API panel!",
    status: "Canceled",
    priority: "Medium",
  },
  {
    id: "TASK-1280",
    type: "Bug",
    title: "Use the digital TLS panel, then you can transmit the haptic system!",
    status: "Done",
    priority: "High",
  },
  {
    id: "TASK-7262",
    type: "Feature",
    title: "The UTF8 application is down, parse the neural bandwidth so we can back...",
    status: "Done",
    priority: "High",
  },
  {
    id: "TASK-1138",
    type: "Feature",
    title: "Generating the driver won't do anything, we need to quantify the 1080p S...",
    status: "In Progress",
    priority: "Medium",
  },
  {
    id: "TASK-7184",
    type: "Feature",
    title: "We need to program the back-end THX pixel!",
    status: "Todo",
    priority: "Low",
  },
  {
    id: "TASK-5160",
    type: "Documentation",
    title: "Calculating the bus won't do anything, we need to navigate the back-end ...",
    status: "In Progress",
    priority: "High",
  },
]

export default function FileTable() {
  const [selectedTasks, setSelectedTasks] = React.useState<string[]>([])
  const [filter, setFilter] = React.useState("")
  const [page, setPage] = React.useState(1)
  const itemsPerPage = 10

  const filteredTasks = tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(filter.toLowerCase()) || task.id.toLowerCase().includes(filter.toLowerCase()),
  )

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage)
  const paginatedTasks = filteredTasks.slice((page - 1) * itemsPerPage, page * itemsPerPage)

  const toggleSelectAll = () => {
    if (selectedTasks.length === paginatedTasks.length) {
      setSelectedTasks([])
    } else {
      setSelectedTasks(paginatedTasks.map((task) => task.id))
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center mb-6">
        <div className="relative flex-1">
          <Input
            placeholder="Filter tasks..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-4"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Status
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Priority
          </Button>
          <Button variant="outline" size="sm">
            View
          </Button>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={paginatedTasks.length > 0 && selectedTasks.length === paginatedTasks.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Task</TableHead>
              <TableHead className="hidden md:table-cell">Title</TableHead>
              <TableHead className="hidden md:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Priority</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedTasks.includes(task.id)}
                    onCheckedChange={() => {
                      setSelectedTasks((prev) =>
                        prev.includes(task.id) ? prev.filter((id) => id !== task.id) : [...prev, task.id],
                      )
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <div className="font-medium">{task.id}</div>
                    <Badge variant="outline" className="w-fit">
                      {task.type}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{task.title}</TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge
                    variant="outline"
                    className={
                      task.status === "Done"
                        ? "bg-green-100 text-green-800 border-green-200"
                        : task.status === "In Progress"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : task.status === "Canceled"
                            ? "bg-red-100 text-red-800 border-red-200"
                            : undefined
                    }
                  >
                    {task.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge
                    variant="outline"
                    className={
                      task.priority === "High"
                        ? "bg-red-100 text-red-800 border-red-200"
                        : task.priority === "Low"
                          ? "bg-green-100 text-green-800 border-green-200"
                          : undefined
                    }
                  >
                    {task.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          {selectedTasks.length} of {filteredTasks.length} row(s) selected.
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <p className="text-sm font-medium">Rows per page:</p>
            <select
              className="h-8 w-16 rounded-md border border-input bg-background px-2"
              value={itemsPerPage}
              disabled
            >
              <option value="10">10</option>
            </select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={page === 1}>
              <ChevronFirst className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage(page - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
              <ChevronLast className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

