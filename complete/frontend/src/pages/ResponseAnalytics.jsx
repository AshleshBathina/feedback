import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { responseAPI, adminAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Download,
  Filter,
  Loader2,
  ArrowLeft,
  ClipboardX,
  Table as TableIcon
} from 'lucide-react';
import Loader from '../components/Loader';
import SubjectComparisonModal from '../components/SubjectComparisonModal';

const ResponseAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [forms, setForms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState('');
  const [activationPeriods, setActivationPeriods] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // Default to 'table'
  const [tableData, setTableData] = useState(null);
  const [loadingTableData, setLoadingTableData] = useState(false);
  const [filters, setFilters] = useState({
    course: '',
    year: '',
    semester: '',
    section: '',
    subject: '',
    activationPeriod: ''
  });
  const [comparisonModal, setComparisonModal] = useState({
    isOpen: false,
    subject: null
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    console.log('useEffect for fetching analytics triggered. selectedForm:', selectedForm, 'filters:', filters);
    if (selectedForm) {
      fetchAnalytics();
    }
  }, [filters, selectedForm]);

  const fetchInitialData = async () => {
    try {
      const [formsRes, coursesRes] = await Promise.all([
        adminAPI.getFeedbackForms(),
        adminAPI.getCourses()
      ]);
      setForms(formsRes.data);
      setCourses(coursesRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast.error('Failed to load data');
      setLoading(false);
    }
  };

  const fetchAnalytics = async (customFilters = null) => {
    if (!selectedForm) return null;

    const currentFilters = customFilters || filters;

    // Validate activation period format
    if (currentFilters.activationPeriod) {
      try {
        currentFilters.activationPeriod = new Date(currentFilters.activationPeriod)
          .toISOString();
      } catch (e) {
        console.error('Invalid activation period date:', currentFilters.activationPeriod);
        toast.error('Invalid activation period');
        return null;
      }
    }

    // Only set loading states when not in comparison mode
    if (!customFilters) {
      setLoading(true);
    }

    try {
      const params = { formId: selectedForm, ...currentFilters };
      const response = await responseAPI.getQuestionAnalytics(params);

      if (!response.data || !response.data.formStats) {
        throw new Error('Invalid response data');
      }

      console.log('Analytics Response:', response.data);

      // Check if we have any responses at all
      const hasResponses = response.data.formStats.totalResponses > 0;

      if (!customFilters) {
        setAnalytics(response.data);
      }

      return {
        analytics: response.data,
        hasResponses
      };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      if (error.response?.status === 404) {
        toast.error('No data found for the selected period');
      } else {
        toast.error('Failed to load analytics');
      }
      return null;
    } finally {
      // Only reset loading states when not in comparison mode
      if (!customFilters) {
        setLoading(false);
      }
    }
  };

  const fetchTableData = async () => {
    if (!selectedForm) return;
    
    setLoadingTableData(true);
    try {
      const params = { formId: selectedForm, ...filters };
      
      // Validate activation period format
      if (params.activationPeriod) {
        try {
          params.activationPeriod = new Date(params.activationPeriod).toISOString();
        } catch (e) {
          console.error('Invalid activation period date:', params.activationPeriod);
          toast.error('Invalid activation period');
          return;
        }
      }
      
      const response = await responseAPI.getAnalyticsTableView(params);
      setTableData(response.data);
    } catch (error) {
      console.error('Error fetching table data:', error);
      toast.error('Failed to load table data');
    } finally {
      setLoadingTableData(false);
    }
  };

  // Fetch table data when switching to table view
  useEffect(() => {
    if (viewMode === 'table' && selectedForm) {
      fetchTableData();
    }
  }, [viewMode, selectedForm, filters]);

  const handleFormChange = (formId) => {
    setSelectedForm(formId);
    setAnalytics(null);

    const form = forms.find((f) => f._id === formId);
    if (form) {
      const periods = form.activationPeriods || [];
      setActivationPeriods(periods);
      if (periods.length > 0) {
        const sortedPeriods = [...periods].sort((a, b) => new Date(b.start) - new Date(a.start));
        setFilters({
          course: '',
          year: '',
          semester: '',
          section: '',
          subject: '',
          activationPeriod: sortedPeriods[0].start,
        });
      } else {
        setFilters({
          course: '',
          year: '',
          semester: '',
          section: '',
          subject: '',
          activationPeriod: '',
        });
      }
    } else {
      setActivationPeriods([]);
      setFilters({
        course: '',
        year: '',
        semester: '',
        section: '',
        subject: '',
        activationPeriod: '',
      });
    }
  };

  const handleFilterChange = (key, value) => {
    console.log('Filter changed:', key, value);
    // Format the activationPeriod date to match server expectations
    if (key === 'activationPeriod' && value) {
      const formattedDate = new Date(value).toISOString();
      setFilters(prev => ({ ...prev, [key]: formattedDate }));
    } else {
      setFilters(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleExport = async () => {
    if (!selectedForm) {
      toast.error('Please select a form first');
      return;
    }

    try {
      const params = { formId: selectedForm, ...filters };
      const response = await responseAPI.exportCSV(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_${selectedForm}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };

  const handleComprehensiveExport = async () => {
    if (!selectedForm) {
      toast.error('Please select a form first');
      return;
    }

    try {
      const params = { 
        formId: selectedForm, 
        course: filters.course,
        activationPeriod: filters.activationPeriod
      };
      const response = await responseAPI.exportComprehensiveAnalytics(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `comprehensive_analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Comprehensive analytics exported successfully');
    } catch (error) {
      console.error('Comprehensive export error:', error);
      toast.error('Failed to export comprehensive analytics');
    }
  };

  if (loading && !analytics) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Modern Header with Gradient */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                title="Go back"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-md">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">
                    Response Analytics
                  </h1>
                  <p className="text-xs text-gray-600 hidden sm:block">Analyze feedback responses</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'charts' ? 'table' : 'charts')}
                disabled={!selectedForm}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {viewMode === 'table' ? (
                  <>
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs">Charts</span>
                  </>
                ) : (
                  <>
                    <TableIcon className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs">Table</span>
                  </>
                )}
              </button>

              <button
                onClick={handleComprehensiveExport}
                disabled={!selectedForm}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-medium hover:from-green-600 hover:to-emerald-700 hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Excel</span>
              </button>

              <button
                onClick={handleExport}
                disabled={!selectedForm}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-300 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <div className="p-1 bg-white rounded-lg shadow-sm">
                <Filter className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <span>Filters</span>
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Feedback Form</label>
                <select
                  value={selectedForm}
                  onChange={(e) => handleFormChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none"
                >
                  <option value="">Select a form</option>
                  {forms.map(form => (
                    <option key={form._id} value={form._id}>{form.formName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Activation Period</label>
                <select
                  value={filters.activationPeriod}
                  onChange={(e) => handleFilterChange('activationPeriod', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedForm || activationPeriods.length === 0}
                >
                  <option value="">All Periods</option>
                  {activationPeriods.map((period, index) => (
                    <option key={index} value={period.start}>
                      {`Period ${index + 1}: ${new Date(period.start).toLocaleDateString()} - ${period.end ? new Date(period.end).toLocaleDateString() : 'Active'}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Course</label>
                <select
                  value={filters.course}
                  onChange={(e) => handleFilterChange('course', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none"
                >
                  <option value="">All Courses</option>
                  {courses.map(course => (
                    <option key={course._id} value={course._id}>{course.courseName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Year</label>
                <select
                  value={filters.year}
                  onChange={(e) => handleFilterChange('year', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none"
                >
                  <option value="">All Years</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Semester</label>
                <select
                  value={filters.semester}
                  onChange={(e) => handleFilterChange('semester', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none"
                >
                  <option value="">All Semesters</option>
                  {[...Array(2)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}{['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th'][i]} Semester</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Section</label>
                <select
                  value={filters.section}
                  onChange={(e) => handleFilterChange('section', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!filters.course || !filters.year || !filters.semester}
                >
                  <option value="">All Sections</option>
                  {filters.course && filters.year && filters.semester && (() => {
                    const course = courses.find(c => c._id === filters.course);
                    const yearSemData = course?.yearSemesterSections?.find(
                      ys => ys.year === parseInt(filters.year) && ys.semester === parseInt(filters.semester)
                    );
                    return yearSemData?.sections?.map(section => (
                      <option key={section._id} value={section._id}>Section {section.sectionName}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Content */}
      <div className="px-4 sm:px-6 lg:px-8 pb-6">
        {analytics ? (
          <div className="space-y-4">
            {/* Form Overview - Modern Stats Cards */}
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3">
                <h3 className="text-base font-bold text-white">{analytics?.form?.formName || 'Analytics'}</h3>
                {analytics?.form?.description && (
                  <p className="text-blue-100 text-xs mt-0.5">{analytics.form.description}</p>
                )}
              </div>

              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-blue-700">{analytics.formStats.totalResponses}</div>
                        <div className="text-xs font-medium text-blue-600 mt-0.5">Total Responses</div>
                      </div>
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <BarChart3 className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-green-700">{analytics.formStats.uniqueStudents}</div>
                        <div className="text-xs font-medium text-green-600 mt-0.5">Unique Students</div>
                      </div>
                      <div className="p-2 bg-green-500 rounded-lg">
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-purple-700">{analytics.formStats.subjects}</div>
                        <div className="text-xs font-medium text-purple-600 mt-0.5">Subjects</div>
                      </div>
                      <div className="p-2 bg-purple-500 rounded-lg">
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-orange-700">{analytics.formStats.courses}</div>
                        <div className="text-xs font-medium text-orange-600 mt-0.5">Courses</div>
                      </div>
                      <div className="p-2 bg-orange-500 rounded-lg">
                        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {/* Table View */}
          {viewMode === 'table' ? (
            loadingTableData ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-royal-600 mx-auto mb-4" />
                <p className="text-gray-600">Loading Table Data...</p>
              </div>
            ) : tableData && tableData.tableGroups && tableData.tableGroups.length > 0 ? (
              <div className="space-y-4">
                {tableData.tableGroups.map((group, groupIdx) => (
                  <div key={groupIdx} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                    {/* Group Header */}
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5">
                      <h3 className="text-sm font-bold text-white">
                        {group.branch} - {group.yearSem} - Section {group.section}
                      </h3>
                      <p className="text-indigo-100 text-xs mt-0.5">
                        {group.rows.length} subject{group.rows.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-blue-600 text-white">
                            <th className="border border-gray-300 px-3 py-2 text-center text-xs font-bold min-w-[120px]">SUBJECT</th>
                            <th className="border border-gray-300 px-3 py-2 text-center text-xs font-bold min-w-[100px]">STAFF</th>
                            <th className="border border-gray-300 px-2 py-2 text-center text-xs font-bold">COUNT</th>
                            {tableData.questions.map((q) => (
                              <th key={q.id} className="border border-gray-300 px-2 py-2 text-center font-bold min-w-[150px] max-w-[250px]">
                                <div className="text-[10px] leading-tight">{q.text}</div>
                                <div className="text-[9px] mt-0.5 opacity-75">({q.id})</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                              <td 
                                className="border border-gray-300 px-2 py-1.5 text-xs cursor-pointer hover:bg-blue-100 transition-colors"
                                onClick={() => setComparisonModal({
                                  isOpen: true,
                                  subject: {
                                    id: row.subjectId,
                                    name: row.subject,
                                    staff: row.staff
                                  }
                                })}
                                title="Click to compare periods"
                              >
                                <span className="text-blue-600 hover:text-blue-800 font-medium underline decoration-dotted">
                                  {row.subject}
                                </span>
                              </td>
                              <td className="border border-gray-300 px-2 py-1.5 text-xs">{row.staff}</td>
                              <td className="border border-gray-300 px-2 py-1.5 text-center text-xs font-semibold">{row.count}</td>
                              {tableData.questions.map((q) => {
                                const value = row[q.id];
                                const bgColor = row.ratingData?.[q.id]?.bgColor || 'transparent';
                                const isTextQuestion = q.type === 'text' || q.type === 'textarea';
                                
                                return (
                                  <td
                                    key={q.id}
                                    className={`border border-gray-300 px-2 py-1.5 ${isTextQuestion ? 'text-left text-[10px]' : 'text-center text-xs'} font-semibold`}
                                    style={{ backgroundColor: bgColor }}
                                  >
                                    <div className={isTextQuestion ? 'break-words max-w-[200px]' : ''}>
                                      {value || '-'}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* Legend for color coding */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl shadow-md border border-gray-200 p-6">
                  <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Rating Legend
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#90EE90' }}></div>
                      <span className="text-sm font-medium text-gray-700">Excellent (4.5-5.0)</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#FFD700' }}></div>
                      <span className="text-sm font-medium text-gray-700">Good (3.5-4.49)</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#FFA500' }}></div>
                      <span className="text-sm font-medium text-gray-700">Average (2.5-3.49)</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#FF6B6B' }}></div>
                      <span className="text-sm font-medium text-gray-700">Poor (&lt;2.5)</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="text-center py-8">
                  <ClipboardX className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">No Data Available</h4>
                  <p className="text-gray-600">No analytics data available for the selected filters.</p>
                </div>
              </div>
            )
          ) : null}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Available</h3>
              <p className="text-gray-600">Please select a feedback form to view analytics</p>
            </div>
          </div>
        )}
      </div>

      {/* Subject Comparison Modal */}
      <SubjectComparisonModal
        isOpen={comparisonModal.isOpen}
        onClose={() => setComparisonModal({ isOpen: false, subject: null })}
        subject={comparisonModal.subject}
        formId={selectedForm}
        activationPeriods={activationPeriods}
      />
    </div>
  );
};

export default ResponseAnalytics;