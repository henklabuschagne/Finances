import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Sparkles, Edit2, Save, X, Calculator } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  color: string;
}

interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  period: 'monthly' | 'yearly';
  isAutoCalculated: boolean;
}

interface Transaction {
  id: string;
  categoryId: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  date: string;
}

interface CategoryBudgetData {
  category: Category;
  budget?: Budget;
  spent: number;
  remaining: number;
  percentage: number;
  isOverBudget: boolean;
}

export function Budget() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Listen for category updates from Categories component
    const handleCategoriesUpdated = () => {
      console.log('Categories updated, refreshing budget data...');
      loadData();
    };

    window.addEventListener('categoriesUpdated', handleCategoriesUpdated);
    
    return () => {
      window.removeEventListener('categoriesUpdated', handleCategoriesUpdated);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, budgetsRes, transactionsRes] = await Promise.all([
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/categories`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/budgets`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/transactions`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
      ]);

      // Check for HTTP errors
      if (!categoriesRes.ok) {
        const text = await categoriesRes.text();
        console.error('Categories API error:', categoriesRes.status, text);
        throw new Error(`Categories API error: ${categoriesRes.status}`);
      }
      
      // Budgets endpoint might not exist yet - handle gracefully
      let budgetsData = { budgets: [] };
      if (budgetsRes.ok) {
        const budgetsText = await budgetsRes.text();
        try {
          budgetsData = JSON.parse(budgetsText);
        } catch (e) {
          console.warn('Budgets response not valid JSON, using empty array');
        }
      } else if (budgetsRes.status === 404) {
        console.info('Budgets endpoint not found, initializing with empty array');
        // Initialize budgets storage
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/budgets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ budgets: [] }),
        });
      }
      
      if (!transactionsRes.ok) {
        const text = await transactionsRes.text();
        console.error('Transactions API error:', transactionsRes.status, text);
        throw new Error(`Transactions API error: ${transactionsRes.status}`);
      }

      // Get response text first to check if it's valid JSON
      const categoriesText = await categoriesRes.text();
      const transactionsText = await transactionsRes.text();

      // Parse JSON
      let categoriesData, transactionsData;
      try {
        categoriesData = JSON.parse(categoriesText);
      } catch (e) {
        console.error('Categories response:', categoriesText);
        throw new Error('Invalid JSON from categories API');
      }

      try {
        transactionsData = JSON.parse(transactionsText);
      } catch (e) {
        console.error('Transactions response:', transactionsText);
        throw new Error('Invalid JSON from transactions API');
      }

      setCategories(categoriesData.categories || []);
      setBudgets(budgetsData.budgets || []);
      setTransactions(transactionsData.transactions || []);
      
      // Clean up orphaned budgets (budgets for deleted categories)
      await cleanupOrphanedBudgets(categoriesData.categories || [], budgetsData.budgets || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load budget data', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const cleanupOrphanedBudgets = async (categories: Category[], budgets: Budget[]) => {
    const categoryIds = new Set(categories.map(cat => cat.id));
    const orphanedBudgets = budgets.filter(budget => !categoryIds.has(budget.categoryId));
    
    if (orphanedBudgets.length > 0) {
      console.log(`Cleaning up ${orphanedBudgets.length} orphaned budgets...`);
      const newBudgets = budgets.filter(budget => categoryIds.has(budget.categoryId));
      
      // Save silently without showing success toast
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/budgets`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ budgets: newBudgets }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to cleanup budgets');
        }

        setBudgets(newBudgets);
        toast.info(`Cleaned up ${orphanedBudgets.length} budget(s) for deleted categories`);
      } catch (error) {
        console.error('Error cleaning up orphaned budgets:', error);
      }
    }
  };

  const autoCalculateBudget = async (categoryId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/budgets/auto-calculate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ categoryId, period }),
        }
      );

      // Get response text first to handle potential JSON parsing errors
      const responseText = await response.text();
      let data;
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate budget');
      }

      if (data.suggestedAmount === 0) {
        toast.info(data.message, {
          description: 'Add transactions for this category to enable auto-calculation',
        });
        return;
      }

      // Show calculation details
      const calc = data.calculation;
      toast.success(`💡 Auto-Budget Calculated: R ${data.suggestedAmount.toLocaleString()}`, {
        description: `Based on ${calc.monthsAnalyzed} months • Avg: R${calc.average} • Median: R${calc.median} (+15% buffer)`,
        duration: 5000,
      });

      // Update or create budget
      const existingBudgetIndex = budgets.findIndex((b) => b.categoryId === categoryId);
      let newBudgets;

      if (existingBudgetIndex >= 0) {
        newBudgets = [...budgets];
        newBudgets[existingBudgetIndex] = {
          ...newBudgets[existingBudgetIndex],
          amount: data.suggestedAmount,
          period,
          isAutoCalculated: true,
        };
      } else {
        newBudgets = [
          ...budgets,
          {
            id: crypto.randomUUID(),
            categoryId,
            amount: data.suggestedAmount,
            period,
            isAutoCalculated: true,
          },
        ];
      }

      await saveBudgets(newBudgets);
    } catch (error) {
      console.error('Error auto-calculating budget:', error);
      toast.error('Failed to auto-calculate budget');
    }
  };

  const saveBudgets = async (updatedBudgets: Budget[]) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/budgets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ budgets: updatedBudgets }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save budgets');
      }

      setBudgets(updatedBudgets);
      toast.success('Budget saved successfully');
    } catch (error) {
      console.error('Error saving budgets:', error);
      toast.error('Failed to save budget');
    }
  };

  const handleManualBudgetSave = async (categoryId: string) => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const existingBudgetIndex = budgets.findIndex((b) => b.categoryId === categoryId);
    let newBudgets;

    if (existingBudgetIndex >= 0) {
      newBudgets = [...budgets];
      newBudgets[existingBudgetIndex] = {
        ...newBudgets[existingBudgetIndex],
        amount,
        period,
        isAutoCalculated: false,
      };
    } else {
      newBudgets = [
        ...budgets,
        {
          id: crypto.randomUUID(),
          categoryId,
          amount,
          period,
          isAutoCalculated: false,
        },
      ];
    }

    await saveBudgets(newBudgets);
    setEditingBudgetId(null);
    setEditAmount('');
  };

  const deleteBudget = async (categoryId: string) => {
    const newBudgets = budgets.filter((b) => b.categoryId !== categoryId);
    await saveBudgets(newBudgets);
    toast.success('Budget removed');
  };

  // Calculate spending for current period
  const getSpendingForCategory = (categoryId: string): number => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return transactions
      .filter((tx) => {
        if (tx.categoryId !== categoryId || tx.type !== 'expense') return false;

        const txDate = new Date(tx.date);
        if (period === 'monthly') {
          return txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
        } else {
          return txDate.getFullYear() === currentYear;
        }
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  // Prepare budget data for display
  const getBudgetData = (): CategoryBudgetData[] => {
    const expenseCategories = categories.filter((cat) => cat.type === 'expense');
    
    return expenseCategories.map((category) => {
      const budget = budgets.find((b) => b.categoryId === category.id && b.period === period);
      const spent = getSpendingForCategory(category.id);
      const budgetAmount = budget?.amount || 0;
      const remaining = budgetAmount - spent;
      const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      const isOverBudget = spent > budgetAmount && budgetAmount > 0;

      return {
        category,
        budget,
        spent,
        remaining,
        percentage,
        isOverBudget,
      };
    });
  };

  const budgetData = getBudgetData();
  const totalBudgeted = budgetData.reduce((sum, item) => sum + (item.budget?.amount || 0), 0);
  const totalSpent = budgetData.reduce((sum, item) => sum + item.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;
  const overallPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading budgets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Budget Management</h2>
          <p className="text-slate-600 mt-2">Track and manage your spending budgets</p>
        </div>
        <div className="flex items-center gap-4">
          <Label htmlFor="period-select" className="text-sm text-slate-600">
            Period:
          </Label>
          <Select value={period} onValueChange={(value: 'monthly' | 'yearly') => setPeriod(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overall Budget Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Budgeted</CardTitle>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              R {totalBudgeted.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600 mt-1">{period === 'monthly' ? 'This month' : 'This year'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Spent</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              R {totalSpent.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600 mt-1">{overallPercentage.toFixed(1)}% of budget</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Remaining</CardTitle>
            <TrendingUp className={`w-4 h-4 ${totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R {Math.abs(totalRemaining).toLocaleString()}
            </div>
            <p className="text-xs text-slate-600 mt-1">{totalRemaining >= 0 ? 'Under budget' : 'Over budget'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Categories</CardTitle>
            <Sparkles className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {budgetData.filter((item) => item.budget).length}/{budgetData.length}
            </div>
            <p className="text-xs text-slate-600 mt-1">With budgets set</p>
          </CardContent>
        </Card>
      </div>

      {/* Budget Progress Bars */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>Your spending vs. budget for {period === 'monthly' ? 'this month' : 'this year'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Total Budget Progress</span>
                <span className="font-medium text-slate-900">{overallPercentage.toFixed(1)}%</span>
              </div>
              <Progress 
                value={Math.min(overallPercentage, 100)} 
                className="h-3"
              />
              {overallPercentage > 100 && (
                <p className="text-xs text-red-600 mt-1">⚠️ Over budget by R {(totalSpent - totalBudgeted).toLocaleString()}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Budgets */}
      <Card>
        <CardHeader>
          <CardTitle>Category Budgets</CardTitle>
          <CardDescription>Set and manage budgets for each expense category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {budgetData.map((item) => (
              <div
                key={item.category.id}
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.category.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900">{item.category.name}</h4>
                        {item.budget?.isAutoCalculated && (
                          <Badge variant="outline" className="text-xs bg-purple-100 border-purple-300 text-purple-700">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Auto
                          </Badge>
                        )}
                        {item.isOverBudget && (
                          <Badge variant="outline" className="text-xs bg-red-100 border-red-300 text-red-700">
                            Over Budget
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                        <span>
                          Spent: <span className="font-medium text-slate-900">R {item.spent.toLocaleString()}</span>
                        </span>
                        {item.budget && (
                          <>
                            <span>•</span>
                            <span>
                              Budget: <span className="font-medium text-slate-900">R {item.budget.amount.toLocaleString()}</span>
                            </span>
                            <span>•</span>
                            <span className={item.remaining >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {item.remaining >= 0 ? 'Remaining' : 'Exceeded'}: R {Math.abs(item.remaining).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {editingBudgetId === item.category.id ? (
                      <>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            placeholder="Amount"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-32"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleManualBudgetSave(item.category.id)}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingBudgetId(null);
                              setEditAmount('');
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => autoCalculateBudget(item.category.id)}
                          title="Auto-calculate budget based on spending history"
                        >
                          <Calculator className="w-4 h-4 mr-1" />
                          Auto
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingBudgetId(item.category.id);
                            setEditAmount(item.budget?.amount.toString() || '');
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        {item.budget && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteBudget(item.category.id)}
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {item.budget && (
                  <div className="mt-3">
                    <div className="relative">
                      <Progress
                        value={Math.min(item.percentage, 100)}
                        className={`h-2 ${item.isOverBudget ? '[&>div]:bg-red-500' : ''}`}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                      <span>{item.percentage.toFixed(0)}% used</span>
                      {item.isOverBudget && (
                        <span className="text-red-600 font-medium">
                          {(item.percentage - 100).toFixed(0)}% over
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {!item.budget && (
                  <p className="text-sm text-slate-500 mt-2 italic">No budget set for this category</p>
                )}
              </div>
            ))}

            {budgetData.length === 0 && (
              <p className="text-center text-slate-500 py-8">No expense categories found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}