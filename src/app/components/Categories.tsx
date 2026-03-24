import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag, Zap, X, TestTube2, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  color: string;
  isRecurring?: boolean;
  descriptionPatterns?: string[];
}

interface Transaction {
  id: string;
  description: string;
  category?: string;
  categoryId?: string;
  type: 'income' | 'expense' | 'transfer';
}

interface PatternTestResult {
  description: string;
  matched: boolean;
  matchedPattern?: string;
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [patternInput, setPatternInput] = useState('');
  const [testDescription, setTestDescription] = useState('');
  const [testResults, setTestResults] = useState<PatternTestResult[]>([]);
  const [showTestResults, setShowTestResults] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense' | 'transfer',
    color: '#3b82f6',
    isRecurring: false,
    descriptionPatterns: [] as string[],
  });

  const colorOptions = [
    { value: '#ef4444', label: 'Red' },
    { value: '#f59e0b', label: 'Orange' },
    { value: '#eab308', label: 'Yellow' },
    { value: '#84cc16', label: 'Lime' },
    { value: '#22c55e', label: 'Green' },
    { value: '#10b981', label: 'Emerald' },
    { value: '#14b8a6', label: 'Teal' },
    { value: '#06b6d4', label: 'Cyan' },
    { value: '#3b82f6', label: 'Blue' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#8b5cf6', label: 'Violet' },
    { value: '#a855f7', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
    { value: '#64748b', label: 'Slate' },
  ];

  useEffect(() => {
    loadCategories();
    loadTransactions();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/categories`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error('Categories API error:', response.status, text);
        throw new Error(`Failed to load categories: ${response.status}`);
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Invalid JSON from categories API:', text);
        throw new Error('Invalid response from server');
      }

      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/transactions`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error('Transactions API error:', response.status, text);
        throw new Error(`Failed to load transactions: ${response.status}`);
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Invalid JSON from transactions API:', text);
        throw new Error('Invalid response from server');
      }

      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transactions', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      let updatedCategories;

      if (editingCategory) {
        // Update existing
        updatedCategories = categories.map(cat =>
          cat.id === editingCategory.id
            ? { ...cat, ...formData }
            : cat
        );
      } else {
        // Add new
        const newCategory: Category = {
          id: crypto.randomUUID(),
          ...formData,
        };
        updatedCategories = [...categories, newCategory];
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/categories`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ categories: updatedCategories }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save category');
      }

      toast.success(editingCategory ? 'Category updated successfully' : 'Category added successfully');
      setShowDialog(false);
      setEditingCategory(null);
      resetForm();
      loadCategories();
      
      // Notify other components that categories have been updated
      window.dispatchEvent(new Event('categoriesUpdated'));
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      const updatedCategories = categories.filter(cat => cat.id !== id);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/categories`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ categories: updatedCategories }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

      toast.success('Category deleted successfully');
      loadCategories();
      
      // Notify other components that categories have been updated
      window.dispatchEvent(new Event('categoriesUpdated'));
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color,
      isRecurring: category.isRecurring || false,
      descriptionPatterns: category.descriptionPatterns || [],
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'expense',
      color: '#3b82f6',
      isRecurring: false,
      descriptionPatterns: [],
    });
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEditingCategory(null);
      resetForm();
    }
    setShowDialog(open);
  };

  const expenseCategories = categories.filter(cat => cat.type === 'expense');
  const incomeCategories = categories.filter(cat => cat.type === 'income');
  const transferCategories = categories.filter(cat => cat.type === 'transfer');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  const testPatterns = () => {
    const results: PatternTestResult[] = transactions.map(transaction => {
      const matchedPattern = formData.descriptionPatterns.find(pattern => new RegExp(pattern, 'i').test(transaction.description));
      return {
        description: transaction.description,
        matched: !!matchedPattern,
        matchedPattern: matchedPattern,
      };
    });
    setTestResults(results);
    setShowTestResults(true);
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Categories</h2>
          <p className="text-slate-600 mt-2">Manage your transaction categories</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Categories</CardTitle>
            <Tag className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{categories.length}</div>
            <p className="text-xs text-slate-600 mt-1">All categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Expense Categories</CardTitle>
            <Tag className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{expenseCategories.length}</div>
            <p className="text-xs text-slate-600 mt-1">For expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Income Categories</CardTitle>
            <Tag className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{incomeCategories.length}</div>
            <p className="text-xs text-slate-600 mt-1">For income</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Transfer Categories</CardTitle>
            <Tag className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{transferCategories.length}</div>
            <p className="text-xs text-slate-600 mt-1">For transfers</p>
          </CardContent>
        </Card>
      </div>

      {/* Categories Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
            <CardDescription>Categories for tracking expenses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expenseCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{category.name}</span>
                        {category.isRecurring && (
                          <Badge variant="outline" className="text-xs bg-blue-100 border-blue-300 text-blue-700">
                            <Zap className="w-3 h-3 mr-1" />
                            Auto-match
                          </Badge>
                        )}
                      </div>
                      {category.isRecurring && category.descriptionPatterns && category.descriptionPatterns.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          Patterns: {category.descriptionPatterns.slice(0, 3).join(', ')}
                          {category.descriptionPatterns.length > 3 && ` +${category.descriptionPatterns.length - 3} more`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(category.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {expenseCategories.length === 0 && (
                <p className="text-center text-slate-500 py-8">No expense categories</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Income Categories</CardTitle>
            <CardDescription>Categories for tracking income</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {incomeCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{category.name}</span>
                        {category.isRecurring && (
                          <Badge variant="outline" className="text-xs bg-blue-100 border-blue-300 text-blue-700">
                            <Zap className="w-3 h-3 mr-1" />
                            Auto-match
                          </Badge>
                        )}
                      </div>
                      {category.isRecurring && category.descriptionPatterns && category.descriptionPatterns.length > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                          Patterns: {category.descriptionPatterns.slice(0, 3).join(', ')}
                          {category.descriptionPatterns.length > 3 && ` +${category.descriptionPatterns.length - 3} more`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(category.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {incomeCategories.length === 0 && (
                <p className="text-center text-slate-500 py-8">No income categories</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transfer Categories</CardTitle>
            <CardDescription>Categories for tracking transfers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {transferCategories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-medium text-slate-900">{category.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(category)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(category.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {transferCategories.length === 0 && (
                <p className="text-center text-slate-500 py-8">No transfer categories</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update category details' : 'Create a new transaction category'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Category Name</Label>
              <Input
                id="category-name"
                placeholder="e.g., Groceries"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="category-type">Type</Label>
              <Select value={formData.type} onValueChange={(value: 'income' | 'expense' | 'transfer') => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category-color">Color</Label>
              <div className="grid grid-cols-7 gap-2 mt-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color.value
                        ? 'border-slate-900 scale-110'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* Recurring/Fixed Category Checkbox */}
            <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Checkbox
                id="category-recurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: !!checked })}
              />
              <div className="flex-1">
                <Label htmlFor="category-recurring" className="text-sm font-medium cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    Recurring/Fixed Category
                  </div>
                </Label>
                <p className="text-xs text-slate-600 mt-1">
                  Auto-match transactions using description patterns (e.g., salary, rent, subscriptions)
                </p>
              </div>
            </div>

            {/* Description Patterns (only shown when recurring is enabled) */}
            {formData.isRecurring && (
              <div className="space-y-3">
                <Label>Description Patterns</Label>
                <p className="text-xs text-slate-600">
                  Add keywords or phrases that identify this category. Transactions matching any pattern will be auto-categorized.
                </p>
                
                {/* Display existing patterns */}
                <div className="flex flex-wrap gap-2">
                  {formData.descriptionPatterns.map((pattern, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="px-3 py-1 bg-blue-100 border-blue-300 text-blue-700"
                    >
                      {pattern}
                      <button
                        type="button"
                        onClick={() => {
                          const newPatterns = formData.descriptionPatterns.filter((_, i) => i !== index);
                          setFormData({ ...formData, descriptionPatterns: newPatterns });
                        }}
                        className="ml-2 text-blue-500 hover:text-blue-700"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  {formData.descriptionPatterns.length === 0 && (
                    <p className="text-sm text-slate-500">No patterns added yet</p>
                  )}
                </div>

                {/* Add new pattern */}
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., 'salary', 'payroll', 'ACME Corp'"
                    value={patternInput}
                    onChange={(e) => setPatternInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && patternInput.trim()) {
                        e.preventDefault();
                        if (!formData.descriptionPatterns.includes(patternInput.trim())) {
                          setFormData({
                            ...formData,
                            descriptionPatterns: [...formData.descriptionPatterns, patternInput.trim()],
                          });
                          setPatternInput('');
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (patternInput.trim() && !formData.descriptionPatterns.includes(patternInput.trim())) {
                        setFormData({
                          ...formData,
                          descriptionPatterns: [...formData.descriptionPatterns, patternInput.trim()],
                        });
                        setPatternInput('');
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Pattern Tester */}
                <div className="pt-4 border-t border-slate-200">
                  <Label className="text-sm font-medium">Test Your Patterns</Label>
                  <p className="text-xs text-slate-600 mb-2">
                    Test if a transaction description would match your patterns
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., 'ACME Corp Monthly Salary'"
                      value={testDescription}
                      onChange={(e) => setTestDescription(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (testDescription.trim()) {
                          const lowerDesc = testDescription.toLowerCase();
                          const matchedPattern = formData.descriptionPatterns.find(pattern =>
                            lowerDesc.includes(pattern.toLowerCase())
                          );
                          
                          if (matchedPattern) {
                            toast.success(`✅ Match found! Pattern: "${matchedPattern}"`, {
                              description: `This transaction would be auto-categorized as "${formData.name}"`
                            });
                          } else {
                            toast.error(`❌ No match`, {
                              description: `Add patterns that appear in "${testDescription}"`
                            });
                          }
                        }
                      }}
                    >
                      <TestTube2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Show matching transactions from database */}
                  {formData.descriptionPatterns.length > 0 && (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const matchingTxs = transactions.filter(tx => {
                            const lowerDesc = tx.description.toLowerCase();
                            return formData.descriptionPatterns.some(pattern =>
                              lowerDesc.includes(pattern.toLowerCase())
                            );
                          });

                          if (matchingTxs.length > 0) {
                            toast.success(`Found ${matchingTxs.length} matching transactions`, {
                              description: `${matchingTxs.slice(0, 3).map(tx => tx.description).join(', ')}${matchingTxs.length > 3 ? '...' : ''}`
                            });
                            setTestResults(matchingTxs.map(tx => {
                              const matchedPattern = formData.descriptionPatterns.find(pattern =>
                                tx.description.toLowerCase().includes(pattern.toLowerCase())
                              );
                              return {
                                description: tx.description,
                                matched: true,
                                matchedPattern,
                              };
                            }));
                            setShowTestResults(true);
                          } else {
                            toast.info('No matching transactions found in your history');
                            setTestResults([]);
                            setShowTestResults(false);
                          }
                        }}
                      >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Find Matching Transactions ({transactions.filter(tx => {
                          const lowerDesc = tx.description.toLowerCase();
                          return formData.descriptionPatterns.some(pattern =>
                            lowerDesc.includes(pattern.toLowerCase())
                          );
                        }).length})
                      </Button>

                      {/* Show matching results */}
                      {showTestResults && testResults.length > 0 && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg max-h-48 overflow-y-auto">
                          <p className="text-sm font-medium text-green-900 mb-2">
                            {testResults.length} Matching Transactions:
                          </p>
                          <div className="space-y-2">
                            {testResults.slice(0, 10).map((result, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="text-slate-700">{result.description}</span>
                                {result.matchedPattern && (
                                  <Badge variant="outline" className="ml-2 text-xs bg-white">
                                    matches "{result.matchedPattern}"
                                  </Badge>
                                )}
                              </div>
                            ))}
                            {testResults.length > 10 && (
                              <p className="text-xs text-slate-500 mt-2">
                                ...and {testResults.length - 10} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingCategory ? 'Update' : 'Add'} Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}