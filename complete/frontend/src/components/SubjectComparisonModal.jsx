import React, { useState, useEffect } from 'react';
import { X, TrendingUp, BarChart3, PieChart, Loader2 } from 'lucide-react';
import { responseAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const SubjectComparisonModal = ({ isOpen, onClose, subject, formId, activationPeriods }) => {
  const [selectedPeriods, setSelectedPeriods] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Auto-select all periods on open
  useEffect(() => {
    if (isOpen && activationPeriods && activationPeriods.length > 0) {
      setSelectedPeriods(activationPeriods.map(p => p.start));
    }
  }, [isOpen, activationPeriods]);

  const handlePeriodToggle = (periodStart) => {
    setSelectedPeriods(prev => {
      if (prev.includes(periodStart)) {
        return prev.filter(p => p !== periodStart);
      } else {
        return [...prev, periodStart];
      }
    });
  };

  const fetchComparisonData = async () => {
    if (selectedPeriods.length === 0) {
      toast.error('Please select at least one period');
      return;
    }

    setLoading(true);
    try {
      const response = await responseAPI.compareSubjectPeriods({
        formId,
        subjectId: subject.id,
        periods: selectedPeriods
      });
      setComparisonData(response.data);
    } catch (error) {
      console.error('Error fetching comparison data:', error);
      toast.error('Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Prepare data for Line Chart (Scale Questions)
  const prepareLineChartData = () => {
    if (!comparisonData) return [];

    const scaleQuestions = comparisonData.periods[0]?.questions.filter(q => q.questionType === 'scale') || [];
    
    return comparisonData.periods.map(period => {
      const dataPoint = { period: period.periodLabel };
      scaleQuestions.forEach((q, idx) => {
        const questionData = period.questions.find(pq => pq.questionText === q.questionText);
        dataPoint[`Q${idx + 1}`] = questionData?.average || 0;
      });
      return dataPoint;
    });
  };

  // Prepare data for Grouped Bar Chart (Multiple Choice Questions)
  const prepareBarChartData = () => {
    if (!comparisonData) return [];

    const mcqQuestions = comparisonData.periods[0]?.questions.filter(q => q.questionType === 'multiple-choice') || [];
    
    return comparisonData.periods.map(period => {
      const dataPoint = { period: period.periodLabel };
      
      mcqQuestions.forEach((q, qIdx) => {
        const questionData = period.questions.find(pq => pq.questionText === q.questionText);
        if (questionData && questionData.optionCounts) {
          Object.entries(questionData.optionCounts).forEach(([option, count]) => {
            dataPoint[`${option.substring(0, 15)}...`] = (dataPoint[`${option.substring(0, 15)}...`] || 0) + count;
          });
        }
      });
      
      return dataPoint;
    });
  };

  // Prepare data for Pie Charts (Text Questions)
  const preparePieChartData = () => {
    if (!comparisonData) return [];

    const textQuestions = comparisonData.periods[0]?.questions.filter(q => q.questionType === 'text' || q.questionType === 'textarea') || [];
    
    return comparisonData.periods.map(period => {
      const periodData = {
        periodLabel: period.periodLabel,
        questions: []
      };

      textQuestions.forEach(q => {
        const questionData = period.questions.find(pq => pq.questionText === q.questionText);
        if (questionData && questionData.topWords) {
          periodData.questions.push({
            questionText: q.questionText,
            data: questionData.topWords.map(w => ({ name: w.word, value: w.count }))
          });
        }
      });

      return periodData;
    });
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{subject.name}</h2>
            <p className="text-blue-100 text-sm mt-0.5">Staff: {subject.staff} | Period Comparison</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Period Selection */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Select Periods to Compare
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {activationPeriods.map((period, index) => (
                <label
                  key={index}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedPeriods.includes(period.start)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPeriods.includes(period.start)}
                    onChange={() => handlePeriodToggle(period.start)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-gray-900">Period {index + 1}</div>
                    <div className="text-[10px] text-gray-600">
                      {new Date(period.start).toLocaleDateString()} - {period.end ? new Date(period.end).toLocaleDateString() : 'Active'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={fetchComparisonData}
              disabled={selectedPeriods.length === 0 || loading}
              className="mt-4 w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4" />
                  Compare Periods
                </>
              )}
            </button>
          </div>

          {/* Charts */}
          {comparisonData && (
            <div className="space-y-6">
              {/* Line Chart for Scale Questions */}
              {prepareLineChartData().length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Rating Questions Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={prepareLineChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis domain={[0, 5]} />
                      <Tooltip />
                      <Legend />
                      {Object.keys(prepareLineChartData()[0] || {}).filter(key => key !== 'period').map((key, idx) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={COLORS[idx % COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Grouped Bar Chart for Multiple Choice Questions */}
              {prepareBarChartData().length > 0 && Object.keys(prepareBarChartData()[0] || {}).length > 1 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    Multiple Choice Questions Distribution
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={prepareBarChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {Object.keys(prepareBarChartData()[0] || {}).filter(key => key !== 'period').map((key, idx) => (
                        <Bar key={key} dataKey={key} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Pie Charts for Text Questions */}
              {preparePieChartData().length > 0 && preparePieChartData()[0].questions.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-purple-600" />
                    Text Response Analysis
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {preparePieChartData().map((periodData, pIdx) => (
                      <div key={pIdx} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 text-center">{periodData.periodLabel}</h4>
                        {periodData.questions.map((q, qIdx) => (
                          <div key={qIdx} className="mb-4">
                            <p className="text-xs text-gray-600 mb-2">{q.questionText}</p>
                            <ResponsiveContainer width="100%" height={200}>
                              <RechartsPieChart>
                                <Pie
                                  data={q.data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={40}
                                  outerRadius={70}
                                  fill="#8884d8"
                                  dataKey="value"
                                  label={(entry) => entry.name}
                                >
                                  {q.data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </RechartsPieChart>
                            </ResponsiveContainer>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!comparisonData && !loading && (
            <div className="text-center py-12">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select periods and click "Compare Periods" to view analytics</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubjectComparisonModal;
