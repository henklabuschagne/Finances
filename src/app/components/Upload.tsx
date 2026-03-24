import { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileText, AlertCircle, CheckCircle, Sparkles, Edit2, Zap, Copy, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useNavigate } from 'react-router';
import { PasteImport } from './PasteImport';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  suggestedCategory?: string;
  categoryConfidence?: string;
  categorySource?: string;
}

export function Upload() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [existingTransactions, setExistingTransactions] = useState<Array<{
    description: string;
    category: string;
    type: 'income' | 'expense' | 'transfer';
  }>>([]);
  const [categories, setCategories] = useState<Array<{
    id: string;
    name: string;
    type: 'income' | 'expense' | 'transfer';
    color: string;
    isRecurring?: boolean;
    descriptionPatterns?: string[];
  }>>([]);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '',
  });

  // Load existing transactions on mount for learning purposes
  useEffect(() => {
    const loadExistingTransactions = async () => {
      try {
        const [txResponse, catResponse] = await Promise.all([
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/transactions`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
          ),
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/categories`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
          ),
        ]);

        if (txResponse.ok) {
          const data = await txResponse.json();
          const transactions = data.transactions || [];
          
          // Extract only what we need for learning
          const learningData = transactions.map((tx: any) => ({
            description: tx.description,
            category: tx.category,
            type: tx.type,
          }));
          
          setExistingTransactions(learningData);
          console.log(`📚 Loaded ${learningData.length} transactions for category learning`);
        }

        if (catResponse.ok) {
          const data = await catResponse.json();
          setCategories(data.categories || []);
          console.log(`📂 Loaded ${data.categories?.length || 0} categories with recurring patterns`);
        }
      } catch (error) {
        console.error('Error loading existing data for learning:', error);
        // Non-critical error, don't show toast
      }
    };

    loadExistingTransactions();
  }, []);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', file);

      // Step 1: Upload the file
      const uploadResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/upload-pdf`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      toast.success('File uploaded! Parsing transactions...');
      
      // Step 2: Parse the PDF
      setParsing(true);
      const parseResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/parse-pdf/${uploadResult.fileId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!parseResponse.ok) {
        const error = await parseResponse.json();
        throw new Error(error.error || 'Parsing failed');
      }

      const parseResult = await parseResponse.json();
      
      if (parseResult.transactions && parseResult.transactions.length > 0) {
        setParsedTransactions(parseResult.transactions);
        toast.success(`Found ${parseResult.transactions.length} transactions! Review and save them below.`);
      } else {
        toast.info('No transactions found in PDF. You can add them manually.');
      }
      
      // Reset file input
      setFile(null);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      console.error('Upload/Parse error:', error);
      toast.error(`Failed: ${error}`);
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const handleSaveParsedTransactions = async () => {
    if (parsedTransactions.length === 0) {
      toast.error('No transactions to save');
      return;
    }

    try {
      setUploading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/transactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ 
            fileId: parsedTransactions[0].fileId || 'parsed',
            transactions: parsedTransactions 
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save transactions');
      }

      toast.success(`${parsedTransactions.length} transactions saved successfully!`);
      setParsedTransactions([]);
      // User can navigate to transactions tab manually if they want
    } catch (error) {
      console.error('Error saving transactions:', error);
      toast.error(`Failed to save: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateParsedTransaction = (id: string, field: string, value: any) => {
    setParsedTransactions(prev => 
      prev.map(tx => tx.id === id ? { ...tx, [field]: value } : tx)
    );
  };

  const handleRemoveParsedTransaction = (id: string) => {
    setParsedTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.amount || !formData.category) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setUploading(true);

      const transaction = {
        id: crypto.randomUUID(),
        date: formData.date,
        description: formData.description,
        amount: parseFloat(formData.amount),
        type: formData.type,
        category: formData.category,
        createdAt: new Date().toISOString(),
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/transactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ 
            fileId: 'manual',
            transactions: [transaction] 
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add transaction');
      }

      toast.success('Transaction added successfully!');
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        type: 'expense',
        category: '',
      });
      
      // User can navigate to transactions tab manually if they want
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast.error(`Failed to add transaction: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const getConfidenceBadge = (confidence?: string) => {
    if (!confidence) return null;
    
    const colors = {
      high: 'bg-green-100 text-green-700 border-green-300',
      medium: 'bg-blue-100 text-blue-700 border-blue-300',
      low: 'bg-amber-100 text-amber-700 border-amber-300',
    };
    
    return (
      <Badge variant="outline" className={colors[confidence as keyof typeof colors]}>
        {confidence === 'high' ? '🎯 Learned' : confidence === 'medium' ? '💡 Suggested' : '❓ Guessed'}
      </Badge>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900">Upload Data</h2>
        <p className="text-slate-600 mt-2">Upload bank statements with auto-parsing or add transactions manually</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* PDF Upload with Auto-Parse */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Upload & Auto-Parse
            </CardTitle>
            <CardDescription>Smart transaction extraction with category suggestions</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <UploadIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-700 font-medium">Choose a PDF file</span>
                  <span className="text-slate-600"> or drag and drop</span>
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                {file && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-700">
                    <FileText className="w-4 h-4" />
                    <span>{file.name}</span>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">✨ Smart Features</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Automatic transaction extraction</li>
                      <li>AI-powered category suggestions</li>
                      <li>Learns from your past categorizations</li>
                      <li>Review before saving</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={!file || uploading || parsing}>
                {uploading ? 'Uploading...' : parsing ? 'Parsing PDF...' : 'Upload & Parse'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card>
          <CardHeader>
            <CardTitle>Add Transaction Manually</CardTitle>
            <CardDescription>Enter transaction details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="e.g., Grocery shopping"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="amount">Amount (ZAR)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(value: 'income' | 'expense') => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Groceries">Groceries</SelectItem>
                    <SelectItem value="Dining">Dining</SelectItem>
                    <SelectItem value="Transportation">Transportation</SelectItem>
                    <SelectItem value="Utilities">Utilities</SelectItem>
                    <SelectItem value="Entertainment">Entertainment</SelectItem>
                    <SelectItem value="Shopping">Shopping</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Salary">Salary</SelectItem>
                    <SelectItem value="Freelance">Freelance</SelectItem>
                    <SelectItem value="Other Income">Other Income</SelectItem>
                    <SelectItem value="Other Expense">Other Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading ? 'Adding...' : 'Add Transaction'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Paste & CSV Import */}
      {parsedTransactions.length === 0 && (
        <div className="mb-8">
          <PasteImport 
            onTransactionsParsed={setParsedTransactions}
            existingTransactions={existingTransactions}
            categories={categories}
          />
        </div>
      )}

      {/* Parsed Transactions Review */}
      {parsedTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Review Extracted Transactions ({parsedTransactions.length})</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setParsedTransactions([])}>
                  Clear All
                </Button>
                <Button onClick={handleSaveParsedTransactions} disabled={uploading}>
                  Save All Transactions
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Review and edit transactions before saving. Categories are suggested based on past behavior and keywords.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTransactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Input
                          type="date"
                          value={tx.date}
                          onChange={(e) => handleUpdateParsedTransaction(tx.id, 'date', e.target.value)}
                          className="w-36"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={tx.description}
                          onChange={(e) => handleUpdateParsedTransaction(tx.id, 'description', e.target.value)}
                          className="min-w-[200px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={tx.amount}
                          onChange={(e) => handleUpdateParsedTransaction(tx.id, 'amount', parseFloat(e.target.value))}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={tx.type} 
                          onValueChange={(value) => handleUpdateParsedTransaction(tx.id, 'type', value)}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Income</SelectItem>
                            <SelectItem value="expense">Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Select 
                            value={tx.category} 
                            onValueChange={(value) => handleUpdateParsedTransaction(tx.id, 'category', value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Groceries">Groceries</SelectItem>
                              <SelectItem value="Dining">Dining</SelectItem>
                              <SelectItem value="Transportation">Transportation</SelectItem>
                              <SelectItem value="Utilities">Utilities</SelectItem>
                              <SelectItem value="Entertainment">Entertainment</SelectItem>
                              <SelectItem value="Shopping">Shopping</SelectItem>
                              <SelectItem value="Healthcare">Healthcare</SelectItem>
                              <SelectItem value="Salary">Salary</SelectItem>
                              <SelectItem value="Freelance">Freelance</SelectItem>
                              <SelectItem value="Other Income">Other Income</SelectItem>
                              <SelectItem value="Other Expense">Other Expense</SelectItem>
                            </SelectContent>
                          </Select>
                          {getConfidenceBadge(tx.categoryConfidence)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveParsedTransaction(tx.id)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Generate realistic sample transactions for testing
function generateSampleTransactions(): ParsedTransaction[] {
  const categories = [
    { name: 'Groceries', keywords: ['Whole Foods', 'Safeway', 'Trader Joe\'s', 'Walmart Grocery'] },
    { name: 'Dining', keywords: ['Starbucks', 'Chipotle', 'McDonald\'s', 'Pizza Hut', 'The Cheesecake Factory'] },
    { name: 'Transportation', keywords: ['Uber', 'Lyft', 'Shell Gas', 'Chevron', 'Metro Card'] },
    { name: 'Utilities', keywords: ['PG&E Electric', 'Comcast Internet', 'Verizon Wireless', 'Water Bill'] },
    { name: 'Entertainment', keywords: ['Netflix', 'Spotify', 'AMC Theaters', 'Steam Games', 'Disney+'] },
    { name: 'Shopping', keywords: ['Amazon', 'Target', 'Best Buy', 'IKEA', 'Apple Store'] },
    { name: 'Healthcare', keywords: ['CVS Pharmacy', 'Walgreens', 'Kaiser Medical', 'Dental Clinic'] },
    { name: 'Salary', keywords: ['Direct Deposit - Salary', 'Payroll Payment'] },
  ];

  const transactions: ParsedTransaction[] = [];
  const now = new Date();

  // Generate income (2-3 times per month)
  for (let month = 0; month < 3; month++) {
    for (let i = 0; i < 2; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - month, 15 + i * 15);
      transactions.push({
        id: crypto.randomUUID(),
        date: date.toISOString().split('T')[0],
        description: categories[7].keywords[0],
        amount: 3500 + Math.random() * 500,
        type: 'income',
        category: 'Salary',
        categoryConfidence: 'high',
        categorySource: 'keyword',
      });
    }
  }

  // Generate expenses (random throughout 3 months)
  for (let i = 0; i < 25; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);

    const catIndex = Math.floor(Math.random() * 7); // Exclude Salary
    const cat = categories[catIndex];
    const keyword = cat.keywords[Math.floor(Math.random() * cat.keywords.length)];

    const amounts = {
      'Groceries': () => 30 + Math.random() * 150,
      'Dining': () => 10 + Math.random() * 60,
      'Transportation': () => 15 + Math.random() * 50,
      'Utilities': () => 50 + Math.random() * 150,
      'Entertainment': () => 10 + Math.random() * 40,
      'Shopping': () => 20 + Math.random() * 200,
      'Healthcare': () => 15 + Math.random() * 100,
    };

    transactions.push({
      id: crypto.randomUUID(),
      date: date.toISOString().split('T')[0],
      description: keyword,
      amount: parseFloat((amounts[cat.name as keyof typeof amounts]()).toFixed(2)),
      type: 'expense',
      category: cat.name,
      categoryConfidence: Math.random() > 0.5 ? 'medium' : 'high',
      categorySource: 'keyword',
    });
  }

  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}