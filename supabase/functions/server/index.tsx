import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const bucketName = 'make-b7579fc5-bank-statements';

// Create storage bucket on startup
async function initStorage() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: false,
      });
      if (error) console.error('Error creating bucket:', error);
      else console.log('Bucket created successfully');
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
}

initStorage();

// Health check endpoint
app.get("/make-server-b7579fc5/health", (c) => {
  return c.json({ status: "ok" });
});

// Upload PDF file
app.post("/make-server-b7579fc5/upload-pdf", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const fileId = crypto.randomUUID();
    const fileName = `${fileId}-${file.name}`;
    
    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
      });

    if (error) {
      console.error('Upload error:', error);
      return c.json({ error: `Failed to upload file: ${error.message}` }, 500);
    }

    // Store file metadata
    const fileMetadata = {
      id: fileId,
      name: file.name,
      path: data.path,
      uploadedAt: new Date().toISOString(),
      size: file.size,
    };

    await kv.set(`file:${fileId}`, fileMetadata);

    return c.json({ 
      success: true, 
      fileId,
      fileName: file.name 
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return c.json({ error: `Error uploading PDF: ${error}` }, 500);
  }
});

// Get all uploaded files
app.get("/make-server-b7579fc5/files", async (c) => {
  try {
    const files = await kv.getByPrefix('file:');
    return c.json({ files: files || [] });
  } catch (error) {
    console.error('Error fetching files:', error);
    return c.json({ error: `Error fetching files: ${error}` }, 500);
  }
});

// Delete file
app.delete("/make-server-b7579fc5/files/:fileId", async (c) => {
  try {
    const fileId = c.req.param('fileId');
    const fileMetadata = await kv.get(`file:${fileId}`);
    
    if (!fileMetadata) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([fileMetadata.path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
    }

    // Delete metadata
    await kv.del(`file:${fileId}`);
    
    // Delete associated transactions
    const transactions = await kv.getByPrefix(`transaction:${fileId}:`);
    for (const transaction of transactions) {
      await kv.del(`transaction:${fileId}:${transaction.id}`);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return c.json({ error: `Error deleting file: ${error}` }, 500);
  }
});

// Add transactions manually
app.post("/make-server-b7579fc5/transactions", async (c) => {
  try {
    const body = await c.req.json();
    const { fileId, transactions } = body;

    if (!transactions || !Array.isArray(transactions)) {
      return c.json({ error: 'Invalid transactions data' }, 400);
    }

    // Get categories for ID mapping
    const categories = await kv.get('categories') || getDefaultCategories();

    // Store each transaction
    for (const transaction of transactions) {
      const txId = transaction.id || crypto.randomUUID();
      
      // Convert category name to categoryId if needed
      let categoryId = transaction.categoryId;
      if (!categoryId && transaction.category) {
        // Find category ID by name
        const category = categories.find((cat: any) => cat.name === transaction.category);
        categoryId = category?.id || '11'; // Default to "Other Expense"
      }
      
      const txData = {
        ...transaction,
        id: txId,
        fileId: fileId || 'manual',
        categoryId: categoryId,
        // Keep category name for backward compatibility during migration
        category: transaction.category,
        createdAt: transaction.createdAt || new Date().toISOString(),
      };
      await kv.set(`transaction:${txData.fileId}:${txId}`, txData);
    }

    return c.json({ success: true, count: transactions.length });
  } catch (error) {
    console.error('Error adding transactions:', error);
    return c.json({ error: `Error adding transactions: ${error}` }, 500);
  }
});

// Get all transactions
app.get("/make-server-b7579fc5/transactions", async (c) => {
  try {
    const allTransactions = await kv.getByPrefix('transaction:');
    return c.json({ transactions: allTransactions || [] });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return c.json({ error: `Error fetching transactions: ${error}` }, 500);
  }
});

// Update transaction
app.put("/make-server-b7579fc5/transactions/:txId", async (c) => {
  try {
    const txId = c.req.param('txId');
    const updates = await c.req.json();

    // Find the transaction
    const allTransactions = await kv.getByPrefix('transaction:');
    const transaction = allTransactions.find((tx: any) => tx.id === txId);

    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const updatedTx = { ...transaction, ...updates };
    await kv.set(`transaction:${transaction.fileId}:${txId}`, updatedTx);

    return c.json({ success: true, transaction: updatedTx });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return c.json({ error: `Error updating transaction: ${error}` }, 500);
  }
});

// Delete transaction
app.delete("/make-server-b7579fc5/transactions/:txId", async (c) => {
  try {
    const txId = c.req.param('txId');
    
    // Find the transaction
    const allTransactions = await kv.getByPrefix('transaction:');
    const transaction = allTransactions.find((tx: any) => tx.id === txId);

    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    await kv.del(`transaction:${transaction.fileId}:${txId}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return c.json({ error: `Error deleting transaction: ${error}` }, 500);
  }
});

// Get categories
app.get("/make-server-b7579fc5/categories", async (c) => {
  try {
    const categories = await kv.get('categories');
    return c.json({ 
      categories: categories || [
        { id: '1', name: 'Groceries', type: 'expense', color: '#10b981', isRecurring: false, descriptionPatterns: [] },
        { id: '2', name: 'Dining', type: 'expense', color: '#f59e0b', isRecurring: false, descriptionPatterns: [] },
        { id: '3', name: 'Transportation', type: 'expense', color: '#3b82f6', isRecurring: false, descriptionPatterns: [] },
        { id: '4', name: 'Utilities', type: 'expense', color: '#8b5cf6', isRecurring: false, descriptionPatterns: [] },
        { id: '5', name: 'Entertainment', type: 'expense', color: '#ec4899', isRecurring: false, descriptionPatterns: [] },
        { id: '6', name: 'Shopping', type: 'expense', color: '#ef4444', isRecurring: false, descriptionPatterns: [] },
        { id: '7', name: 'Healthcare', type: 'expense', color: '#06b6d4', isRecurring: false, descriptionPatterns: [] },
        { id: '8', name: 'Salary', type: 'income', color: '#22c55e', isRecurring: true, descriptionPatterns: ['salary', 'payroll', 'wage', 'income'] },
        { id: '9', name: 'Freelance', type: 'income', color: '#84cc16', isRecurring: false, descriptionPatterns: [] },
        { id: '10', name: 'Other Income', type: 'income', color: '#14b8a6', isRecurring: false, descriptionPatterns: [] },
        { id: '11', name: 'Other Expense', type: 'expense', color: '#64748b', isRecurring: false, descriptionPatterns: [] },
      ]
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return c.json({ error: `Error fetching categories: ${error}` }, 500);
  }
});

// Get budgets
app.get("/make-server-b7579fc5/budgets", async (c) => {
  try {
    const budgets = await kv.get('budgets');
    return c.json({ budgets: budgets || [] });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return c.json({ error: `Error fetching budgets: ${error}` }, 500);
  }
});

// Save budgets
app.post("/make-server-b7579fc5/budgets", async (c) => {
  try {
    const { budgets } = await c.req.json();
    await kv.set('budgets', budgets);
    return c.json({ success: true, budgets });
  } catch (error) {
    console.error('Error saving budgets:', error);
    return c.json({ error: `Error saving budgets: ${error}` }, 500);
  }
});

// Auto-calculate budget suggestions based on historical spending
app.post("/make-server-b7579fc5/budgets/auto-calculate", async (c) => {
  try {
    const { categoryId, period = 'monthly' } = await c.req.json();
    
    // Get all transactions
    const transactions = await kv.getByPrefix('transaction:') || [];
    const categories = await kv.get('categories') || [];
    
    // Find category
    const category = categories.find((cat: any) => cat.id === categoryId);
    if (!category) {
      return c.json({ error: 'Category not found' }, 404);
    }
    
    // Filter transactions for this category
    const categoryTransactions = transactions.filter((tx: any) => 
      tx.categoryId === categoryId && tx.type === 'expense'
    );
    
    if (categoryTransactions.length === 0) {
      return c.json({ 
        suggestedAmount: 0,
        message: 'No historical data available',
        calculation: {
          period,
          monthsAnalyzed: 0,
          average: 0,
          median: 0,
          min: 0,
          max: 0,
          buffer: '15%',
          formula: 'No data available'
        }
      });
    }
    
    // Group transactions by month
    const monthlyTotals: { [key: string]: number } = {};
    categoryTransactions.forEach((tx: any) => {
      const date = new Date(tx.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + tx.amount;
    });
    
    const monthlyAmounts = Object.values(monthlyTotals);
    
    // Calculate statistics
    const average = monthlyAmounts.reduce((sum, amt) => sum + amt, 0) / monthlyAmounts.length;
    const sorted = [...monthlyAmounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = Math.max(...monthlyAmounts);
    const min = Math.min(...monthlyAmounts);
    
    // Use median + 15% buffer as suggested budget (more conservative than average)
    const suggestedMonthly = Math.ceil(median * 1.15);
    const suggestedAmount = period === 'monthly' ? suggestedMonthly : suggestedMonthly * 12;
    
    return c.json({
      suggestedAmount,
      calculation: {
        period,
        monthsAnalyzed: monthlyAmounts.length,
        average: Math.round(average),
        median: Math.round(median),
        min: Math.round(min),
        max: Math.round(max),
        buffer: '15%',
        formula: 'Median + 15% buffer'
      },
      message: `Based on ${monthlyAmounts.length} months of data`
    });
  } catch (error) {
    console.error('Error calculating budget:', error);
    return c.json({ error: `Error calculating budget: ${error}` }, 500);
  }
});

// Smart category suggestion based on description
function suggestCategory(description: string, existingCategories: any[], allTransactions: any[]) {
  const lowerDesc = description.toLowerCase();
  
  // PRIORITY 1: Check recurring categories with description patterns (HIGHEST PRIORITY)
  for (const category of existingCategories) {
    if (category.isRecurring && category.descriptionPatterns && category.descriptionPatterns.length > 0) {
      for (const pattern of category.descriptionPatterns) {
        if (lowerDesc.includes(pattern.toLowerCase())) {
          console.log(`🎯 RECURRING MATCH: "${description}" matched pattern "${pattern}" → ${category.name}`);
          return { 
            category: category.name, 
            categoryId: category.id,
            confidence: 'high', 
            source: 'recurring-pattern' 
          };
        }
      }
    }
  }
  
  // PRIORITY 2: Check if we've categorized similar transactions before (learning from history)
  const similarTransaction = allTransactions.find((tx: any) => 
    tx.description && tx.description.toLowerCase().includes(lowerDesc.split(' ')[0])
  );
  
  if (similarTransaction && similarTransaction.category) {
    return { 
      category: similarTransaction.category,
      categoryId: similarTransaction.categoryId,
      confidence: 'high', 
      source: 'learned' 
    };
  }
  
  // PRIORITY 3: Keyword-based category suggestions (fallback)
  const categoryKeywords: { [key: string]: string[] } = {
    'Groceries': ['grocery', 'supermarket', 'whole foods', 'trader joe', 'safeway', 'kroger', 'walmart', 'food', 'market'],
    'Dining': ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'pizza', 'bar', 'grill', 'dining', 'eatery', 'bistro'],
    'Transportation': ['uber', 'lyft', 'gas', 'fuel', 'parking', 'metro', 'transit', 'taxi', 'shell', 'chevron', 'exxon'],
    'Utilities': ['electric', 'water', 'gas', 'internet', 'phone', 'cable', 'utility', 'verizon', 'at&t', 'comcast'],
    'Entertainment': ['movie', 'netflix', 'spotify', 'hulu', 'disney', 'theater', 'concert', 'ticket', 'game', 'entertainment'],
    'Shopping': ['amazon', 'target', 'best buy', 'mall', 'store', 'shop', 'retail', 'online'],
    'Healthcare': ['pharmacy', 'doctor', 'hospital', 'medical', 'dental', 'clinic', 'cvs', 'walgreens', 'health'],
    'Salary': ['salary', 'payroll', 'wage', 'income', 'direct deposit', 'payment received'],
    'Freelance': ['freelance', 'contract', 'consulting', 'gig', 'upwork', 'fiverr'],
  };
  
  for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword)) {
        // Find category ID
        const category = existingCategories.find((cat: any) => cat.name === categoryName);
        return { 
          category: categoryName, 
          categoryId: category?.id || '11',
          confidence: 'medium', 
          source: 'keyword' 
        };
      }
    }
  }
  
  return { 
    category: 'Other Expense', 
    categoryId: '11',
    confidence: 'low', 
    source: 'default' 
  };
}

// Parse PDF and extract transactions
app.post("/make-server-b7579fc5/parse-pdf/:fileId", async (c) => {
  try {
    const fileId = c.req.param('fileId');
    const fileMetadata = await kv.get(`file:${fileId}`);
    
    if (!fileMetadata) {
      return c.json({ error: 'File not found' }, 404);
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(fileMetadata.path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return c.json({ error: 'Failed to download file' }, 500);
    }

    // Get text from PDF
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Multiple extraction methods
    let text = '';
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const pdfText = decoder.decode(uint8Array);
      
      // Method 1: Extract text between parentheses
      const textMatches = pdfText.match(/\(([^)]+)\)/g) || [];
      const method1Text = textMatches
        .map(match => match.slice(1, -1))
        .join(' ')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')');
      
      // Method 2: Look for text after 'Tj' or 'TJ' operators (PDF text showing operators)
      const tjMatches = pdfText.match(/\(([^)]*)\)\s*Tj/gi) || [];
      const method2Text = tjMatches
        .map(match => {
          const textMatch = match.match(/\(([^)]*)\)/);
          return textMatch ? textMatch[1] : '';
        })
        .join(' ')
        .replace(/\\n/g, '\n');
      
      // Method 3: Extract any readable ASCII text
      let method3Text = '';
      for (let i = 0; i < uint8Array.length - 1; i++) {
        const byte = uint8Array[i];
        // Look for printable ASCII characters
        if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
          method3Text += String.fromCharCode(byte);
        } else if (byte === 0) {
          method3Text += ' ';
        }
      }
      
      // Use the longest extracted text
      const texts = [method1Text, method2Text, method3Text];
      text = texts.reduce((longest, current) => 
        current.length > longest.length ? current : longest
      , '');
      
      console.log(`PDF text extraction: Method1=${method1Text.length}chars, Method2=${method2Text.length}chars, Method3=${method3Text.length}chars, Selected=${text.length}chars`);
      
    } catch (extractError) {
      console.error('PDF text extraction error:', extractError);
      return c.json({ error: 'Failed to extract text from PDF. The PDF may be encrypted or corrupted.' }, 500);
    }

    if (!text || text.length < 10) {
      console.log('No text extracted from PDF');
      return c.json({ 
        error: 'No text could be extracted from the PDF. This may be a scanned/image-based PDF.',
        success: false,
        transactions: []
      }, 400);
    }
    
    console.log('First 1000 chars of extracted text:', text.substring(0, 1000));
    
    // Get existing categories and transactions for smart suggestions
    const categories = await kv.get('categories') || [];
    const allTransactions = await kv.getByPrefix('transaction:') || [];
    
    // Extract transactions using bank statement pattern matching
    const transactions = [];
    const lines = text.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 0);
    
    console.log(`Processing ${lines.length} lines from PDF`);
    
    // Bank statement specific patterns
    // Date format: DD/MM/YYYY (e.g., 13/09/2025)
    const datePattern = /\b(\d{2}\/\d{2}\/\d{4})\b/;
    
    // Amount patterns - handle spaces and different formats
    const amountPattern = /\b(\d{1,3}(?:[\s,]\d{3})*(?:[.,]\d{2})?)\b/;
    
    // Transaction type keywords
    const transactionTypes = [
      'Pos Purchase',
      'Atm Withdrawal',
      'Debit Order',
      'Credit',
      'Transfer',
      'Deposit',
      'Payment',
      'Fee',
      'Charge'
    ];
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // Look for date at start of line
      const dateMatch = line.match(datePattern);
      if (!dateMatch) {
        i++;
        continue;
      }
      
      const dateStr = dateMatch[1];
      let transactionLines = [line];
      
      // Collect next 3-5 lines that belong to this transaction
      // (multi-line descriptions, effective dates, etc.)
      let j = i + 1;
      while (j < lines.length && j < i + 5) {
        const nextLine = lines[j];
        // Stop if we hit another date (new transaction)
        if (datePattern.test(nextLine)) {
          break;
        }
        transactionLines.push(nextLine);
        j++;
      }
      
      const fullTransaction = transactionLines.join(' ');
      
      // Extract transaction type
      let transactionType = '';
      for (const type of transactionTypes) {
        if (fullTransaction.toLowerCase().includes(type.toLowerCase())) {
          transactionType = type;
          break;
        }
      }
      
      // Extract merchant/description
      // Look for patterns like "Card No. 7559 West Pack Express" or "Gregory's Convenience"
      let description = transactionType;
      
      // Try to find merchant name after "Card No." or transaction type
      const cardNoMatch = fullTransaction.match(/Card No\.\s+\d+\s+([A-Za-z0-9\s\*']+?)(?:\s+Randb|\s+Johan|\s+Linde|\s+Risid|$)/i);
      if (cardNoMatch) {
        description = cardNoMatch[1].trim();
      } else {
        // Try to extract text between transaction type and amount
        const descMatch = fullTransaction.match(/(?:Settlement|Withdrawal|Payment)\s+([A-Za-z0-9\s\*']+?)\s+\d/);
        if (descMatch) {
          description = descMatch[1].trim();
        }
      }
      
      // Clean up description
      description = description
        .replace(/\s+/g, ' ')
        .replace(/Card No\.\s+\d+/gi, '')
        .replace(/\(Effective.*?\)/gi, '')
        .replace(/Settlement/gi, '')
        .trim()
        .substring(0, 100);
      
      if (description.length < 3) {
        description = transactionType || 'Transaction';
      }
      
      // Extract amounts from the transaction lines
      // Look for amounts in the format: 322.70 or 43 233.11
      const amounts = [];
      const amountMatches = fullTransaction.match(new RegExp(amountPattern, 'g'));
      
      if (amountMatches) {
        for (const match of amountMatches) {
          // Convert amount (handle both space and comma separators)
          const cleanAmount = match.replace(/\s/g, '').replace(/,/g, '');
          const num = parseFloat(cleanAmount);
          
          // Filter reasonable amounts (> 0 and < 1,000,000)
          if (!isNaN(num) && num > 0 && num < 1000000) {
            amounts.push(num);
          }
        }
      }
      
      // Use the first reasonable amount found (usually the transaction amount, not the balance)
      let amount = 0;
      if (amounts.length > 0) {
        // The transaction amount is typically the smaller number (not the balance)
        // Sort and take the first one that's less than 100,000
        const sortedAmounts = amounts.filter(a => a < 100000).sort((a, b) => a - b);
        amount = sortedAmounts[0] || amounts[0];
      }
      
      if (amount === 0 || !amount) {
        i = j;
        continue;
      }
      
      // Parse date from DD/MM/YYYY to YYYY-MM-DD
      const dateParts = dateStr.split('/');
      let parsedDate;
      try {
        // DD/MM/YYYY format
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
      
      // Determine type (income vs expense)
      // Debits are expenses, Credits are income
      const isIncome = fullTransaction.toLowerCase().includes('credit') || 
                      fullTransaction.toLowerCase().includes('deposit') ||
                      fullTransaction.toLowerCase().includes('salary') ||
                      fullTransaction.toLowerCase().includes('payment received');
      
      // Get smart category suggestion
      const suggestion = suggestCategory(description, categories, allTransactions);
      
      transactions.push({
        id: crypto.randomUUID(),
        date: parsedDate.toISOString().split('T')[0],
        description,
        amount,
        type: isIncome ? 'income' : 'expense',
        category: suggestion.category,
        suggestedCategory: suggestion.category,
        categoryConfidence: suggestion.confidence,
        categorySource: suggestion.source,
        fileId,
        rawLine: fullTransaction.substring(0, 200) // For debugging
      });
      
      i = j; // Move to next transaction
    }
    
    console.log(`Extracted ${transactions.length} transactions`);
    
    // Remove duplicates based on date + amount + description similarity
    const uniqueTransactions = [];
    const seen = new Set();
    
    for (const tx of transactions) {
      const key = `${tx.date}-${tx.amount}-${tx.description.substring(0, 15)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTransactions.push(tx);
      }
    }
    
    console.log(`After deduplication: ${uniqueTransactions.length} unique transactions`);
    
    return c.json({ 
      success: true, 
      transactions: uniqueTransactions,
      totalFound: uniqueTransactions.length,
      debug: {
        textLength: text.length,
        linesProcessed: lines.length,
        preview: text.substring(0, 500)
      }
    });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return c.json({ error: `Error parsing PDF: ${error}` }, 500);
  }
});

// Suggest category for a description
app.post("/make-server-b7579fc5/suggest-category", async (c) => {
  try {
    const { description } = await c.req.json();
    
    if (!description) {
      return c.json({ error: 'Description required' }, 400);
    }
    
    const categories = await kv.get('categories') || [];
    const allTransactions = await kv.getByPrefix('transaction:') || [];
    
    const suggestion = suggestCategory(description, categories, allTransactions);
    
    return c.json({ 
      success: true,
      ...suggestion
    });
  } catch (error) {
    console.error('Error suggesting category:', error);
    return c.json({ error: `Error suggesting category: ${error}` }, 500);
  }
});

// Migrate transactions to use categoryId instead of category names
app.post("/make-server-b7579fc5/migrate-categories", async (c) => {
  try {
    const categories = await kv.get('categories') || getDefaultCategories();
    const allTransactions = await kv.getByPrefix('transaction:');
    
    let migratedCount = 0;
    let alreadyMigratedCount = 0;
    let failedCount = 0;
    
    for (const transaction of allTransactions) {
      // Skip if already has categoryId
      if (transaction.categoryId) {
        alreadyMigratedCount++;
        continue;
      }
      
      // Find category ID by name
      let categoryId = '11'; // Default to "Other Expense"
      if (transaction.category) {
        const category = categories.find((cat: any) => cat.name === transaction.category);
        if (category) {
          categoryId = category.id;
        } else {
          console.log(`Warning: No category found for "${transaction.category}", using default`);
        }
      }
      
      try {
        // Update transaction with categoryId
        const updatedTx = {
          ...transaction,
          categoryId: categoryId,
        };
        
        await kv.set(`transaction:${transaction.fileId}:${transaction.id}`, updatedTx);
        migratedCount++;
      } catch (error) {
        console.error(`Failed to migrate transaction ${transaction.id}:`, error);
        failedCount++;
      }
    }
    
    return c.json({ 
      success: true,
      migratedCount,
      alreadyMigratedCount,
      failedCount,
      totalTransactions: allTransactions.length
    });
  } catch (error) {
    console.error('Error migrating categories:', error);
    return c.json({ error: `Error migrating categories: ${error}` }, 500);
  }
});

Deno.serve(app.fetch);

// Helper function to get default categories
function getDefaultCategories() {
  return [
    { id: '1', name: 'Groceries', type: 'expense', color: '#10b981', isRecurring: false, descriptionPatterns: [] },
    { id: '2', name: 'Dining', type: 'expense', color: '#f59e0b', isRecurring: false, descriptionPatterns: [] },
    { id: '3', name: 'Transportation', type: 'expense', color: '#3b82f6', isRecurring: false, descriptionPatterns: [] },
    { id: '4', name: 'Utilities', type: 'expense', color: '#8b5cf6', isRecurring: false, descriptionPatterns: [] },
    { id: '5', name: 'Entertainment', type: 'expense', color: '#ec4899', isRecurring: false, descriptionPatterns: [] },
    { id: '6', name: 'Shopping', type: 'expense', color: '#ef4444', isRecurring: false, descriptionPatterns: [] },
    { id: '7', name: 'Healthcare', type: 'expense', color: '#06b6d4', isRecurring: false, descriptionPatterns: [] },
    { id: '8', name: 'Salary', type: 'income', color: '#22c55e', isRecurring: true, descriptionPatterns: ['salary', 'payroll', 'wage', 'income'] },
    { id: '9', name: 'Freelance', type: 'income', color: '#84cc16', isRecurring: false, descriptionPatterns: [] },
    { id: '10', name: 'Other Income', type: 'income', color: '#14b8a6', isRecurring: false, descriptionPatterns: [] },
    { id: '11', name: 'Other Expense', type: 'expense', color: '#64748b', isRecurring: false, descriptionPatterns: [] },
  ];
}