import { useState } from 'react';
import { Copy, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  categoryConfidence?: string;
  categorySource?: string;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  color: string;
  isRecurring?: boolean;
  descriptionPatterns?: string[];
}

interface PasteImportProps {
  onTransactionsParsed: (transactions: ParsedTransaction[]) => void;
  existingTransactions?: Array<{
    description: string;
    category: string;
    type: 'income' | 'expense' | 'transfer';
  }>;
  categories?: Category[];
}

export function PasteImport({ onTransactionsParsed, existingTransactions = [], categories = [] }: PasteImportProps) {
  const [pastedText, setPastedText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Enhanced category suggestion with recurring patterns FIRST, then learning
  const suggestCategoryWithLearning = (description: string, type: 'income' | 'expense' | 'transfer') => {
    const lowerDesc = description.toLowerCase();
    
    // PRIORITY 1: Check recurring categories with description patterns (HIGHEST PRIORITY!)
    for (const category of categories) {
      if (category.isRecurring && category.descriptionPatterns && category.descriptionPatterns.length > 0) {
        for (const pattern of category.descriptionPatterns) {
          if (lowerDesc.includes(pattern.toLowerCase())) {
            console.log(`🎯 RECURRING MATCH: "${description}" matched pattern "${pattern}" → ${category.name}`);
            return { 
              category: category.name, 
              confidence: 'high', 
              source: 'recurring-pattern' 
            };
          }
        }
      }
    }
    
    // PRIORITY 2: Check existing transactions for exact or similar matches
    if (existingTransactions.length > 0) {
      // Try exact match first
      const exactMatch = existingTransactions.find(tx => 
        tx.description.toLowerCase() === lowerDesc && tx.type === type
      );
      
      if (exactMatch) {
        console.log(`✅ Exact match found for "${description}" -> ${exactMatch.category}`);
        return { 
          category: exactMatch.category, 
          confidence: 'high', 
          source: 'exact-match' 
        };
      }
      
      // Try partial match (description contains or is contained in existing transaction)
      const partialMatch = existingTransactions.find(tx => {
        const existingDesc = tx.description.toLowerCase();
        const currentDesc = lowerDesc;
        
        // Match if either contains the other (and they're reasonably long)
        const minLength = 5; // Avoid matching very short strings
        if (currentDesc.length >= minLength && existingDesc.length >= minLength) {
          // Extract meaningful words (remove common words)
          const commonWords = ['the', 'and', 'or', 'at', 'in', 'on', 'for', 'to', 'of', 'a', 'an'];
          const extractWords = (str: string) => 
            str.split(/\s+/)
              .filter(word => word.length > 2 && !commonWords.includes(word));
          
          const currentWords = extractWords(currentDesc);
          const existingWords = extractWords(existingDesc);
          
          // Check if significant overlap exists (at least 50% of words match)
          const matchCount = currentWords.filter(word => 
            existingWords.some(ew => ew.includes(word) || word.includes(ew))
          ).length;
          
          const matchRatio = matchCount / Math.max(currentWords.length, existingWords.length);
          return matchRatio >= 0.5 && tx.type === type;
        }
        
        return false;
      });
      
      if (partialMatch) {
        console.log(`🎯 Partial match found for "${description}" -> ${partialMatch.category}`);
        return { 
          category: partialMatch.category, 
          confidence: 'medium', 
          source: 'partial-match' 
        };
      }
      
      // Try keyword match from learned transactions
      const keywordMatch = existingTransactions.find(tx => {
        const existingWords = tx.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        return existingWords.some(word => lowerDesc.includes(word)) && tx.type === type;
      });
      
      if (keywordMatch) {
        console.log(`🔍 Keyword match found for "${description}" -> ${keywordMatch.category}`);
        return { 
          category: keywordMatch.category, 
          confidence: 'medium', 
          source: 'keyword-learning' 
        };
      }
    }
    
    // PRIORITY 3: Fall back to keyword-based suggestion
    return suggestCategory(description);
  };

  const suggestCategory = (description: string) => {
    const lowerDesc = description.toLowerCase();
    
    const categoryKeywords: { [key: string]: string[] } = {
      'Groceries': ['grocery', 'supermarket', 'whole foods', 'trader joe', 'safeway', 'kroger', 'walmart', 'food', 'market', 'spar', 'checkers', 'woolworths', 'pnp', 'pick n pay'],
      'Dining': ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'pizza', 'bar', 'grill', 'dining', 'eatery', 'bistro', 'romans', 'kfc', 'nandos', "gregory's"],
      'Transportation': ['uber', 'lyft', 'gas', 'fuel', 'parking', 'metro', 'transit', 'taxi', 'shell', 'chevron', 'exxon', 'atm withdrawal'],
      'Utilities': ['electric', 'water', 'gas', 'internet', 'phone', 'cable', 'utility', 'verizon', 'at&t', 'comcast'],
      'Entertainment': ['movie', 'netflix', 'spotify', 'hulu', 'disney', 'theater', 'concert', 'ticket', 'game', 'entertainment', 'yoco'],
      'Shopping': ['amazon', 'target', 'best buy', 'mall', 'store', 'shop', 'retail', 'online', 'west pack', 'express'],
      'Healthcare': ['pharmacy', 'doctor', 'hospital', 'medical', 'dental', 'clinic', 'cvs', 'walgreens', 'health', 'oasis water'],
      'Salary': ['salary', 'payroll', 'wage', 'income', 'direct deposit', 'payment received'],
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (lowerDesc.includes(keyword)) {
          return { category, confidence: 'medium', source: 'keyword' };
        }
      }
    }
    
    return { category: 'Other Expense', confidence: 'low', source: 'default' };
  };

  const parseTextTransactions = (text: string): ParsedTransaction[] => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const transactions: ParsedTransaction[] = [];
    
    console.log('🔍 Total lines to parse:', lines.length);
    
    // Date patterns for bank statements - allow 1 or 2 digits for day/month
    const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/;
    
    let i = 0;
    let skippedCount = 0;
    let parsedCount = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Look for date
      const dateMatch = line.match(datePattern);
      if (!dateMatch) {
        i++;
        continue;
      }
      
      // Skip "(Effective XX/XX/XXXX)" lines - these are headers, not transactions
      if (line.toLowerCase().includes('(effective') || 
          line.toLowerCase().includes('effective')) {
        console.log('⏭️  Skipped effective date header:', line);
        i++;
        continue;
      }
      
      // Skip "Bal Brought Forward" lines
      if (line.toLowerCase().includes('bal brought forward') || 
          line.toLowerCase().includes('balance brought forward')) {
        console.log('⏭️  Skipped balance forward:', line);
        i++;
        continue;
      }
      
      const dateStr = dateMatch[1];
      
      // Collect next few lines for this transaction
      const transactionLines = [line];
      let j = i + 1;
      while (j < lines.length && j < i + 5) {
        const nextLine = lines[j];
        // Stop if we hit another date line (but not an Effective line)
        if (datePattern.test(nextLine) && !nextLine.toLowerCase().includes('effective')) {
          break;
        }
        transactionLines.push(nextLine);
        j++;
      }
      
      const fullTransaction = transactionLines.join(' ');
      console.log('📝 Processing transaction:', fullTransaction.substring(0, 100));
      
      // IMPORTANT: Remove the date from the text BEFORE extracting amounts
      // Otherwise date parts (13, 09, 2025) will be captured as amounts
      const textWithoutDate = fullTransaction.replace(dateMatch[0], '');
      
      // Extract amounts - handle space separators properly
      // Pattern: number with optional spaces for thousands separator and decimal point
      // Examples: "322.70" or "43 233.11" or "42 910.41"
      const amountPattern = /\b(\d{1,3}(?:\s\d{3})*(?:\.\d{2})?)\b/g;
      const amounts: number[] = [];
      
      let match;
      while ((match = amountPattern.exec(textWithoutDate)) !== null) {
        // Remove spaces and parse
        const cleanAmount = match[1].replace(/\s/g, '');
        const num = parseFloat(cleanAmount);
        if (!isNaN(num) && num > 0) {
          amounts.push(num);
        }
      }
      
      console.log('  💰 Found amounts:', amounts);
      
      if (amounts.length === 0) {
        console.log('  ❌ No amounts found, skipping');
        skippedCount++;
        i = j;
        continue;
      }
      
      // ABSA format: Date | Description | Transaction Amount | Balance
      // The transaction amount is ALWAYS the FIRST amount
      // The balance is the SECOND (larger) amount
      // Strategy: If we have 2+ amounts, take the FIRST one as the transaction
      // This is because the balance always comes last in the line
      let amount = 0;
      
      if (amounts.length >= 2) {
        // Take the first amount (transaction), ignore the second (balance)
        amount = amounts[0];
      } else if (amounts.length === 1) {
        // Only one amount found - likely just the transaction
        amount = amounts[0];
      }
      
      if (amount === 0) {
        console.log('  ❌ Amount is zero, skipping');
        skippedCount++;
        i = j;
        continue;
      }
      
      // Extract description
      let description = fullTransaction
        .replace(dateMatch[0], '')
        .replace(/Card No\.\s+\d+/gi, '')
        .replace(/\(Effective.*?\)/gi, '')
        .replace(/Pos Purchase|Settlement|Atm Withdrawal/gi, '')
        .replace(/\d{1,3}(?:\s\d{3})*(?:\.\d{2})?/g, '') // Remove all amounts
        .replace(/Randb|Johan|Linde|Risid/g, '') // Remove location codes
        .replace(/\s+/g, ' ')
        .trim();
      
      // Clean up description further
      description = description
        .replace(/^\s*-\s*/, '') // Remove leading dashes
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 100);
      
      if (description.length < 3) {
        description = 'Transaction';
      }
      
      // Parse date from DD/MM/YYYY
      const dateParts = dateStr.split('/');
      let parsedDate;
      try {
        parsedDate = new Date(
          parseInt(dateParts[2]), // year
          parseInt(dateParts[1]) - 1, // month (0-indexed)
          parseInt(dateParts[0]) // day
        );
        
        if (isNaN(parsedDate.getTime())) {
          parsedDate = new Date();
        }
      } catch (e) {
        parsedDate = new Date();
      }
      
      // Determine type - ABSA uses "Cr" for Credit (income) and "Dt" for Debit (expense)
      // Also look for specific transaction types
      const isIncome = 
        fullTransaction.toLowerCase().includes(' cr ') || // Credit transactions
        fullTransaction.toLowerCase().includes('credit') ||
        fullTransaction.toLowerCase().includes('deposit') ||
        fullTransaction.toLowerCase().includes('salary') ||
        fullTransaction.match(/\bcr\b/i) !== null || // Word boundary for "Cr"
        fullTransaction.includes('Digital Payment Cr') ||
        fullTransaction.includes('Digital Transf Cr') ||
        fullTransaction.includes('Acb Credit');
      
      // Get category suggestion
      const suggestion = suggestCategoryWithLearning(description, isIncome ? 'income' : 'expense');
      
      transactions.push({
        id: crypto.randomUUID(),
        date: parsedDate.toISOString().split('T')[0],
        description,
        amount,
        type: isIncome ? 'income' : 'expense',
        category: suggestion.category,
        categoryConfidence: suggestion.confidence,
        categorySource: suggestion.source,
      });
      
      parsedCount++;
      i = j;
    }
    
    console.log(`📊 Parsed ${parsedCount} transactions, skipped ${skippedCount}`);
    
    // Remove duplicates
    const uniqueTransactions: ParsedTransaction[] = [];
    const seen = new Set();
    
    for (const tx of transactions) {
      const key = `${tx.date}-${tx.amount}-${tx.description.substring(0, 15)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTransactions.push(tx);
      }
    }
    
    return uniqueTransactions;
  };

  const parseCsvFile = async (file: File): Promise<ParsedTransaction[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          
          if (lines.length === 0) {
            reject(new Error('CSV file is empty'));
            return;
          }
          
          // Parse header to detect columns
          const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
          
          const dateIdx = header.findIndex(h => h.includes('date'));
          const descIdx = header.findIndex(h => h.includes('desc') || h.includes('merchant') || h.includes('name'));
          const amountIdx = header.findIndex(h => h.includes('amount') || h.includes('value'));
          const typeIdx = header.findIndex(h => h.includes('type') || h.includes('category'));
          
          if (dateIdx === -1 || amountIdx === -1) {
            reject(new Error('CSV must have Date and Amount columns'));
            return;
          }
          
          const transactions: ParsedTransaction[] = [];
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            
            if (values.length < 2) continue;
            
            const dateStr = values[dateIdx];
            const amountStr = values[amountIdx];
            const description = descIdx !== -1 ? values[descIdx] : 'Transaction';
            
            // Parse amount
            const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
            if (isNaN(amount) || amount === 0) continue;
            
            // Parse date
            let parsedDate;
            try {
              parsedDate = new Date(dateStr);
              if (isNaN(parsedDate.getTime())) {
                // Try DD/MM/YYYY format
                const parts = dateStr.split(/[-\/]/);
                if (parts.length === 3) {
                  parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
              }
            } catch (e) {
              parsedDate = new Date();
            }
            
            const isIncome = amount > 0 || (typeIdx !== -1 && values[typeIdx].toLowerCase().includes('income'));
            const suggestion = suggestCategoryWithLearning(description, isIncome ? 'income' : 'expense');
            
            transactions.push({
              id: crypto.randomUUID(),
              date: parsedDate.toISOString().split('T')[0],
              description,
              amount: Math.abs(amount),
              type: isIncome ? 'income' : 'expense',
              category: suggestion.category,
              categoryConfidence: suggestion.confidence,
              categorySource: suggestion.source,
            });
          }
          
          resolve(transactions);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handlePasteText = () => {
    if (!pastedText.trim()) {
      toast.error('Please paste some text first');
      return;
    }
    
    try {
      const transactions = parseTextTransactions(pastedText);
      
      if (transactions.length === 0) {
        toast.error('No transactions found in the pasted text');
        return;
      }
      
      onTransactionsParsed(transactions);
      toast.success(`Found ${transactions.length} transactions!`);
      setPastedText('');
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(`Failed to parse: ${error}`);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }
    
    try {
      const transactions = await parseCsvFile(csvFile);
      
      if (transactions.length === 0) {
        toast.error('No transactions found in CSV');
        return;
      }
      
      onTransactionsParsed(transactions);
      toast.success(`Imported ${transactions.length} transactions from CSV!`);
      setCsvFile(null);
      const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('CSV parse error:', error);
      toast.error(`Failed to parse CSV: ${error}`);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Text Paste Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-purple-600" />
            Paste from PDF
          </CardTitle>
          <CardDescription>Copy text from your PDF and paste it here</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="paste-text">Paste Bank Statement Text</Label>
            <Textarea
              id="paste-text"
              placeholder="Paste your bank statement text here...&#10;Example:&#10;13/09/2025 Pos Purchase Settlement 322.70&#10;Card No. 7559 West Pack Express&#10;..."
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
          
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
            <p className="font-medium mb-1">How to use:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open your PDF bank statement</li>
              <li>Select and copy all transaction text (Ctrl/Cmd + C)</li>
              <li>Paste it in the box above</li>
              <li>Click "Parse Transactions"</li>
            </ol>
          </div>
          
          <Button onClick={handlePasteText} className="w-full" disabled={!pastedText.trim()}>
            Parse Transactions
          </Button>
        </CardContent>
      </Card>

      {/* CSV Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Import from CSV
          </CardTitle>
          <CardDescription>Upload a CSV file with your transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-green-400 transition-colors">
            <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <Label htmlFor="csv-upload" className="cursor-pointer">
              <span className="text-green-600 hover:text-green-700 font-medium">Choose a CSV file</span>
            </Label>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            />
            {csvFile && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-700">
                <FileSpreadsheet className="w-4 h-4" />
                <span>{csvFile.name}</span>
              </div>
            )}
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            <p className="font-medium mb-1">CSV Format:</p>
            <p className="mb-2">Your CSV should have these columns:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Date</strong> - Transaction date</li>
              <li><strong>Description</strong> - Merchant/details</li>
              <li><strong>Amount</strong> - Transaction amount</li>
              <li>Type (optional) - income/expense</li>
            </ul>
          </div>
          
          <Button onClick={handleCsvUpload} className="w-full" disabled={!csvFile}>
            Import from CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}