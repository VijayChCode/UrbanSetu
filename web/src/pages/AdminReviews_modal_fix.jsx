import UrbanSetuSpinner from '../components/UrbanSetuSpinner';
import { FaFlag, FaTimes, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';

      {/* Review Reports Modal */}
      {showReportsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-pink-50">
              <h2 className="text-xl sm:text-2xl font-bold text-red-700 flex items-center gap-2">
                <FaFlag />
                Review Reports
              </h2>
              <button
                onClick={() => setShowReportsModal(false)}
                className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={reportsFilters.dateFrom}
                    onChange={(e) => setReportsFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={reportsFilters.dateTo}
                    onChange={(e) => setReportsFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reporter</label>
                  <input
                    type="text"
                    placeholder="Filter by reporter"
                    value={reportsFilters.reporter}
                    onChange={(e) => setReportsFilters(prev => ({ ...prev, reporter: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <input
                    type="text"
                    placeholder="Search reports..."
                    value={reportsFilters.search}
                    onChange={(e) => setReportsFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={reportsFilters.sortBy}
                    onChange={(e) => setReportsFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="date">Sort by Date</option>
                    <option value="reporter">Sort by Reporter</option>
                    <option value="property">Sort by Property</option>
                    <option value="category">Sort by Category</option>
                  </select>
                  <select
                    value={reportsFilters.sortOrder}
                    onChange={(e) => setReportsFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setReportsFilters({
                        dateFrom: '',
                        dateTo: '',
                        reporter: '',
                        search: '',
                        sortBy: 'date',
                        sortOrder: 'desc'
                      });
                    }}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={fetchReports}
                    disabled={reportsLoading}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {reportsLoading ? (
                      <>
                        <UrbanSetuSpinner size="sm" isBright={true} />
                        Loading...
                      </>
                    ) : (
                      <>
                        <FaSync />
                        Refresh
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Reports List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Debug info */}
              <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
                Debug: Loading={reportsLoading.toString()}, Error={reportsError}, Reports={reports.length}
              </div>
              {reportsLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <UrbanSetuSpinner size="lg" />
                  <span className="text-gray-600 font-medium animate-pulse">Fetching latest reports...</span>
                </div>
              ) : reportsError ? (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-2">{reportsError}</div>
                  <button
                    onClick={fetchReports}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                  >
                    Try Again
                  </button>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8">
                  <FaFlag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No review reports found</p>
                  <p className="text-gray-400 text-sm">Reports will appear here when users report reviews</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    Showing {reports.length} report{reports.length !== 1 ? 's' : ''}
                  </div>
                  {reports.map((report, index) => (
                    <div key={report.notificationId || index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <FaFlag className="mr-1" />
                              Review Report
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(report.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="font-medium text-gray-700">Property: </span>
                              <span className="text-gray-900">{report.propertyName}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Reporter: </span>
                              <span className="text-gray-900">{report.reporter}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Category: </span>
                              <span className="text-gray-900">{report.category}</span>
                            </div>
                            {report.details && (
                              <div>
                                <span className="font-medium text-gray-700">Details: </span>
                                <span className="text-gray-900">{report.details}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          {report.listingId && (
                            <a
                              href={`/admin/listing/${report.listingId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition text-center"
                            >
                              View Property
                            </a>
                          )}
                          {report.reviewId && (
                            <button
                              onClick={() => {
                                // You could implement a function to view the specific review
                                toast.info('Review ID: ' + report.reviewId);
                              }}
                              className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition"
                            >
                              View Review
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}