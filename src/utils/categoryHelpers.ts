import { projectId, publicAnonKey } from '/utils/supabase/info';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  color: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string;
  category?: string; // Deprecated: for backward compatibility
  [key: string]: any;
}

// Get category name from ID
export function getCategoryName(categoryId: string | undefined, categories: Category[]): string {
  if (!categoryId) return 'Uncategorized';
  const category = categories.find(cat => cat.id === categoryId);
  return category?.name || 'Uncategorized';
}

// Get category from ID
export function getCategory(categoryId: string | undefined, categories: Category[]): Category | undefined {
  if (!categoryId) return undefined;
  return categories.find(cat => cat.id === categoryId);
}

// Get category ID from name (for backward compatibility)
export function getCategoryIdFromName(categoryName: string | undefined, categories: Category[]): string {
  if (!categoryName) return '11'; // Default to "Other Expense"
  const category = categories.find(cat => cat.name === categoryName);
  return category?.id || '11';
}

// Run migration to convert old transactions to use categoryId
export async function runCategoryMigration(): Promise<{
  success: boolean;
  migratedCount?: number;
  alreadyMigratedCount?: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/migrate-categories`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Migration failed' };
    }

    const result = await response.json();
    console.log('📦 Category migration completed:', result);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error running category migration:', error);
    return { success: false, error: String(error) };
  }
}

// Ensure transaction has categoryId (convert from category name if needed)
export function ensureTransactionHasCategoryId(
  transaction: Transaction,
  categories: Category[]
): Transaction {
  if (transaction.categoryId) {
    return transaction; // Already has categoryId
  }

  // Convert category name to ID
  if (transaction.category) {
    const categoryId = getCategoryIdFromName(transaction.category, categories);
    return {
      ...transaction,
      categoryId,
    };
  }

  // No category at all - use default
  return {
    ...transaction,
    categoryId: '11', // Other Expense
  };
}
