import { useState, useEffect } from 'react';

function App() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Simple function to get data from our Python backend
  const fetchReviews = async () => {
    setLoading(true);
    setError(""); // reset any old errors
    try {
      console.log("Fetching latest reviews...");
      const response = await fetch('http://localhost:8000/api/reviews');
      if (!response.ok) {
        throw new Error("Failed to fetch data from backend");
      }
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      // Just show a simple error message on the screen
      setError("Oops! Could not connect to the backend server.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when the page first loads
  useEffect(() => {
    fetchReviews();
  }, []);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="bg-white p-6 border border-gray-300 shadow-sm max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">AI PR Reviewer - Lab Dashboard</h1>
        <p className="text-gray-600 mb-6">Internal tool to track automated PR code reviews.</p>
        
        {/* Simple refresh button */}
        <button 
          onClick={fetchReviews}
          className="bg-blue-600 text-white px-4 py-2 border border-blue-800 hover:bg-blue-700 mb-4 font-medium cursor-pointer"
        >
          Refresh Data
        </button>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mb-4 font-mono text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <p className="p-4 border border-gray-300 bg-gray-50 italic text-gray-500">Loading data from API...</p>
        ) : (
          <table className="w-full border-collapse border border-gray-400 text-left">
            <thead>
              <tr className="bg-gray-200 text-gray-800">
                <th className="border border-gray-400 p-3 w-24">PR #</th>
                <th className="border border-gray-400 p-3 w-64">Repository</th>
                <th className="border border-gray-400 p-3">AI Summary</th>
              </tr>
            </thead>
            <tbody>
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan="3" className="border border-gray-400 p-6 text-center text-gray-500 italic">
                    No reviews yet. Waiting for webhooks...
                  </td>
                </tr>
              ) : (
                reviews.map((review, index) => (
                  <tr key={index} className="hover:bg-yellow-50">
                    <td className="border border-gray-400 p-3 font-semibold">#{review.pr_number}</td>
                    <td className="border border-gray-400 p-3 font-mono text-sm text-blue-800">{review.repo}</td>
                    <td className="border border-gray-400 p-3 text-sm text-gray-700 whitespace-pre-wrap">{review.review}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
