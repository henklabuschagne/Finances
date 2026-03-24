import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  List,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  fileId?: string;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  color: string;
}

export function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [timeframe, setTimeframe] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [txResponse, catResponse] = await Promise.all([
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/transactions`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b7579fc5/categories`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }),
      ]);

      if (!txResponse.ok || !catResponse.ok) {
        throw new Error('Failed to load data');
      }

      const txData = await txResponse.json();
      const catData = await catResponse.json();

      setTransactions(txData.transactions || []);
      setCategories(catData.categories || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const filteredTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    if (timeframe === 'monthly') {
      return txDate.getMonth() === selectedMonth && txDate.getFullYear() === selectedYear;
    } else {
      return txDate.getFullYear() === selectedYear;
    }
  });

  // If no transactions in current period, show all transactions instead
  const displayTransactions = filteredTransactions.length > 0 ? filteredTransactions : transactions;
  
  // Determine what period we're actually showing
  const getDisplayPeriod = () => {
    if (filteredTransactions.length > 0) {
      if (timeframe === 'monthly') {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        return `${monthNames[selectedMonth]} ${selectedYear}`;
      } else {
        return selectedYear.toString();
      }
    } else if (transactions.length > 0) {
      // Show the most recent transaction's period
      const sortedTx = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const mostRecent = new Date(sortedTx[0].date);
      return timeframe === 'monthly'
        ? mostRecent.toLocaleString('default', { month: 'long', year: 'numeric' })
        : 'All Time';
    }
    if (timeframe === 'monthly') {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return `${monthNames[selectedMonth]} ${selectedYear}`;
    } else {
      return selectedYear.toString();
    }
  };

  const totalIncome = displayTransactions
    .filter(tx => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = displayTransactions
    .filter(tx => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netIncome = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((netIncome / totalIncome) * 100) : 0;

  // Prepare chart data
  const getCategoryData = () => {
    const categoryMap = new Map();
    
    displayTransactions
      .filter(tx => tx.type === 'expense')
      .forEach(tx => {
        const current = categoryMap.get(tx.category) || 0;
        categoryMap.set(tx.category, current + tx.amount);
      });

    return Array.from(categoryMap.entries()).map(([name, value]) => {
      const category = categories.find(c => c.name === name);
      return {
        name,
        value: Number(value.toFixed(2)),
        color: category?.color || '#64748b',
      };
    }).sort((a, b) => b.value - a.value);
  };

  const getMonthlyTrend = () => {
    const monthMap = new Map();
    
    if (timeframe === 'monthly') {
      // For monthly view: show all 12 months of current year
      // But if no data in current year, use the most recent year with data
      let yearToShow = currentYear;
      
      const yearsWithData = new Set<number>();
      transactions.forEach(tx => {
        yearsWithData.add(new Date(tx.date).getFullYear());
      });
      
      // If current year has no transactions, use the most recent year
      const hasCurrentYearData = transactions.some(tx => new Date(tx.date).getFullYear() === currentYear);
      if (!hasCurrentYearData && yearsWithData.size > 0) {
        const sortedYears = Array.from(yearsWithData).sort((a, b) => b - a);
        yearToShow = sortedYears[0]; // Most recent year
      }
      
      const relevantTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getFullYear() === yearToShow;
      });

      relevantTransactions.forEach(tx => {
        const date = new Date(tx.date);
        const monthIndex = date.getMonth();
        const monthKey = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex];
        
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, { month: monthKey, income: 0, expenses: 0 });
        }
        
        const data = monthMap.get(monthKey);
        if (tx.type === 'income') {
          data.income += tx.amount;
        } else if (tx.type === 'expense') {
          data.expenses += tx.amount;
        }
        // Transfer transactions are excluded from income/expense trends
      });

      // Return all 12 months even if some have no data
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.map(month => 
        monthMap.get(month) || { month, income: 0, expenses: 0 }
      );
    } else {
      // For yearly view: show all available years
      const years = new Set<number>();
      transactions.forEach(tx => {
        years.add(new Date(tx.date).getFullYear());
      });
      
      const sortedYears = Array.from(years).sort((a, b) => a - b);
      
      transactions.forEach(tx => {
        const date = new Date(tx.date);
        const year = date.getFullYear();
        const yearKey = year.toString();
        
        if (!monthMap.has(yearKey)) {
          monthMap.set(yearKey, { month: yearKey, income: 0, expenses: 0 });
        }
        
        const data = monthMap.get(yearKey);
        if (tx.type === 'income') {
          data.income += tx.amount;
        } else {
          data.expenses += tx.amount;
        }
      });

      return sortedYears.map(year => 
        monthMap.get(year.toString()) || { month: year.toString(), income: 0, expenses: 0 }
      );
    }
  };

  const categoryData = getCategoryData();
  const trendData = getMonthlyTrend();

  // Get category summary by month/year
  const getCategorySummary = () => {
    if (timeframe === 'monthly') {
      // Monthly view: show categories for each month of current year
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const summary = new Map<string, Map<string, number>>();
      
      // Get all unique categories
      const allCategories = new Set<string>();
      transactions.forEach(tx => allCategories.add(tx.category));
      
      transactions
        .filter(tx => new Date(tx.date).getFullYear() === currentYear)
        .forEach(tx => {
          const date = new Date(tx.date);
          const monthIndex = date.getMonth();
          const monthKey = months[monthIndex];
          
          if (!summary.has(tx.category)) {
            summary.set(tx.category, new Map());
          }
          
          const categoryMap = summary.get(tx.category)!;
          const currentAmount = categoryMap.get(monthKey) || 0;
          categoryMap.set(monthKey, currentAmount + tx.amount);
        });
      
      return {
        periods: months,
        data: Array.from(summary.entries()).map(([category, monthData]) => {
          const row: any = { category };
          let total = 0;
          months.forEach(month => {
            const amount = monthData.get(month) || 0;
            row[month] = amount;
            total += amount;
          });
          row.total = total;
          return row;
        }).sort((a, b) => b.total - a.total),
      };
    } else {
      // Yearly view: show categories for each year
      const years = new Set<number>();
      transactions.forEach(tx => years.add(new Date(tx.date).getFullYear()));
      const sortedYears = Array.from(years).sort((a, b) => a - b);
      
      const summary = new Map<string, Map<string, number>>();
      
      transactions.forEach(tx => {
        const year = new Date(tx.date).getFullYear().toString();
        
        if (!summary.has(tx.category)) {
          summary.set(tx.category, new Map());
        }
        
        const categoryMap = summary.get(tx.category)!;
        const currentAmount = categoryMap.get(year) || 0;
        categoryMap.set(year, currentAmount + tx.amount);
      });
      
      return {
        periods: sortedYears.map(y => y.toString()),
        data: Array.from(summary.entries()).map(([category, yearData]) => {
          const row: any = { category };
          let total = 0;
          sortedYears.forEach(year => {
            const amount = yearData.get(year.toString()) || 0;
            row[year.toString()] = amount;
            total += amount;
          });
          row.total = total;
          return row;
        }).sort((a, b) => b.total - a.total),
      };
    }
  };

  const categorySummary = getCategorySummary();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900">Financial Dashboard</h2>
        <p className="text-slate-600 mt-2">
          Overview of your finances for {getDisplayPeriod()}
        </p>
      </div>

      <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as 'monthly' | 'yearly')} className="mb-6">
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">Yearly</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Period Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {timeframe === 'monthly' && (
              <div>
                <Label htmlFor="month-select">Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger id="month-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">January</SelectItem>
                    <SelectItem value="1">February</SelectItem>
                    <SelectItem value="2">March</SelectItem>
                    <SelectItem value="3">April</SelectItem>
                    <SelectItem value="4">May</SelectItem>
                    <SelectItem value="5">June</SelectItem>
                    <SelectItem value="6">July</SelectItem>
                    <SelectItem value="7">August</SelectItem>
                    <SelectItem value="8">September</SelectItem>
                    <SelectItem value="9">October</SelectItem>
                    <SelectItem value="10">November</SelectItem>
                    <SelectItem value="11">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label htmlFor="year-select">Year</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger id="year-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Income</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">R{totalIncome.toFixed(2)}</div>
            <div className="flex items-center mt-1 text-xs text-green-600">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              Revenue
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Expenses</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">R{totalExpenses.toFixed(2)}</div>
            <div className="flex items-center mt-1 text-xs text-red-600">
              <ArrowDownRight className="w-3 h-3 mr-1" />
              Spending
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Net Income</CardTitle>
            <Coins className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R{netIncome.toFixed(2)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {netIncome >= 0 ? 'Positive' : 'Negative'} balance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Savings Rate</CardTitle>
            <Calendar className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{savingsRate.toFixed(1)}%</div>
            <p className="text-xs text-slate-600 mt-1">Of total income</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses Trend</CardTitle>
            <CardDescription>
              {timeframe === 'monthly' ? 'Monthly breakdown for current year' : 'Yearly comparison'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `R${Number(value).toFixed(2)}`} />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} name="Income" />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
            <CardDescription>Distribution of spending</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `R${Number(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                No expense data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Top Spending Categories</CardTitle>
          <CardDescription>Your biggest expense categories this {timeframe === 'monthly' ? 'month' : 'year'}</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `R${Number(value).toFixed(2)}`} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500">
              No spending data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Summary Table */}
      {categorySummary.data.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              Category Summary by {timeframe === 'monthly' ? 'Month' : 'Year'}
            </CardTitle>
            <CardDescription>
              Detailed breakdown of all categories {timeframe === 'monthly' ? `for ${currentYear}` : 'across all years'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold sticky left-0 bg-white z-10">Category</TableHead>
                    {categorySummary.periods.map((period) => (
                      <TableHead key={period} className="text-right font-semibold">
                        {period}
                      </TableHead>
                    ))}
                    <TableHead className="text-right font-semibold bg-slate-50">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorySummary.data.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell className="font-medium sticky left-0 bg-white z-10">
                        {row.category}
                      </TableCell>
                      {categorySummary.periods.map((period) => (
                        <TableCell key={period} className="text-right">
                          {row[period] > 0 ? `R${row[period].toFixed(2)}` : '-'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold bg-slate-50">
                        R{row.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {displayTransactions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Financial Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {netIncome > 0 && (
                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">Positive Cash Flow</p>
                    <p className="text-sm text-green-700">
                      You're saving R{netIncome.toFixed(2)} this {timeframe === 'monthly' ? 'month' : 'year'}. Keep up the good work!
                    </p>
                  </div>
                </div>
              )}
              
              {netIncome < 0 && (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Spending Alert</p>
                    <p className="text-sm text-red-700">
                      Your expenses exceed income by R{Math.abs(netIncome).toFixed(2)}. Consider reviewing your budget.
                    </p>
                  </div>
                </div>
              )}

              {categoryData.length > 0 && categoryData[0].value > totalExpenses * 0.3 && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                  <Coins className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Top Spending Category</p>
                    <p className="text-sm text-blue-700">
                      {categoryData[0].name} accounts for {((categoryData[0].value / totalExpenses) * 100).toFixed(0)}% of your expenses (R{categoryData[0].value.toFixed(2)}).
                    </p>
                  </div>
                </div>
              )}

              {savingsRate >= 20 && (
                <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-900">Great Savings Rate!</p>
                    <p className="text-sm text-purple-700">
                      You're saving {savingsRate.toFixed(0)}% of your income. This is above the recommended 20%!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {displayTransactions.length === 0 && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No transactions yet</h3>
              <p className="text-slate-600 mb-4">Upload a bank statement or add transactions manually to get started</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}