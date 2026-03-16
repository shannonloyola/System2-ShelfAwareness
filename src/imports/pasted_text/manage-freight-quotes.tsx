Please add a “Manage Freight Quotes” feature inside the P.O. Builder.

1) Add a secondary button labeled “Manage Freight Quotes” near the builder actions (below the line items section). On click, open a modal.

2) Modal content:
- Title: “Freight Quotes”
- A table listing quotes with columns:
  Provider | Freight Type | Quoted Cost | Estimated Days | Action
- Each row has a button: “Select as Winner”

3) Below the table, include an “Add New Quote” form with:
- logistics_provider (text input)
- freight_type (select: Sea, Air)
- quoted_cost (number input)
- estimated_days (number input)
- submit button: “Add Quote”

Use the JSX + state below.

Imports needed:
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

State + handlers:
const [showQuotes, setShowQuotes] = useState(false);
const [quotes, setQuotes] = useState([
  { id: "1", provider: "Nippon Yusen (NYK Line)", freightType: "Sea", cost: 350000, days: 14, winner: false },
  { id: "2", provider: "Japan Airlines Cargo", freightType: "Air", cost: 620000, days: 4, winner: false }
]);
const [newQuote, setNewQuote] = useState({ provider: "", freightType: "", cost: "", days: "" });

const addQuote = () => {
  if (!newQuote.provider || !newQuote.freightType || !newQuote.cost || !newQuote.days) return;
  setQuotes((prev) => [
    ...prev,
    {
      id: `${Date.now()}`,
      provider: newQuote.provider,
      freightType: newQuote.freightType,
      cost: Number(newQuote.cost),
      days: Number(newQuote.days),
      winner: false
    }
  ]);
  setNewQuote({ provider: "", freightType: "", cost: "", days: "" });
};

const selectWinner = (id) => {
  setQuotes((prev) => prev.map((q) => ({ ...q, winner: q.id === id })));
};

Button + modal JSX:
<Button variant="outline" onClick={() => setShowQuotes(true)} className="border-[#111827]/20 text-[#111827]">
  Manage Freight Quotes
</Button>

<Dialog open={showQuotes} onOpenChange={setShowQuotes}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>Freight Quotes</DialogTitle>
    </DialogHeader>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Provider</TableHead>
          <TableHead>Freight Type</TableHead>
          <TableHead>Quoted Cost</TableHead>
          <TableHead>Estimated Days</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quotes.map((q) => (
          <TableRow key={q.id} className={q.winner ? "bg-[#00A3AD]/10" : ""}>
            <TableCell>{q.provider}</TableCell>
            <TableCell>{q.freightType}</TableCell>
            <TableCell>₱{q.cost.toLocaleString()}</TableCell>
            <TableCell>{q.days} days</TableCell>
            <TableCell>
              <Button size="sm" onClick={() => selectWinner(q.id)} className="bg-[#00A3AD] hover:bg-[#0891B2] text-white">
                {q.winner ? "Selected" : "Select as Winner"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    <div className="mt-6 space-y-3 rounded-lg border border-[#E5E7EB] p-4 bg-[#F8FAFC]">
      <div className="font-semibold text-[#111827]">Add New Quote</div>
      <Input placeholder="Logistics Provider" value={newQuote.provider} onChange={(e) => setNewQuote({ ...newQuote, provider: e.target.value })} />
      <Select value={newQuote.freightType} onValueChange={(value) => setNewQuote({ ...newQuote, freightType: value })}>
        <SelectTrigger><SelectValue placeholder="Freight Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Sea">Sea</SelectItem>
          <SelectItem value="Air">Air</SelectItem>
        </SelectContent>
      </Select>
      <Input type="number" placeholder="Quoted Cost" value={newQuote.cost} onChange={(e) => setNewQuote({ ...newQuote, cost: e.target.value })} />
      <Input type="number" placeholder="Estimated Days" value={newQuote.days} onChange={(e) => setNewQuote({ ...newQuote, days: e.target.value })} />
      <Button onClick={addQuote} className="bg-[#00A3AD] hover:bg-[#0891B2] text-white">Add Quote</Button>
    </div>
  </DialogContent>
</Dialog>
