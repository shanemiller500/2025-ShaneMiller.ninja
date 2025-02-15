"use client";

import React, { useState, useEffect } from "react";

const RandomActivity = () => {
  const [activityData, setActivityData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  const getActivity = async () => {
    try {
      const response = await fetch("https://www.boredapi.com/api/activity");
      const data = await response.json();
      setActivityData(data);
    } catch (error) {
      console.error("Error fetching activity:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshActivity = () => {
    setClickCount((prev) => {
      const newCount = prev + 1;
      if (newCount === 3) {
        alert("You must have a black belt in clicking by now...");
      } else if (newCount === 4) {
        alert("At this rate, you might break the internet with your clicking prowess!");
      } else if (newCount === 5) {
        alert("Seriously, maybe take a break? Do you have click habit abuse syndrome?");
      } else if (newCount === 6) {
        alert("Why don't you give it a rest? Maybe go bike riding or something?");
        // Optionally, you can avoid closing the window in a web app.
      }
      return newCount;
    });
    setLoading(true);
    // Simulate 2-second delay before fetching new activity
    setTimeout(() => {
      getActivity();
    }, 2000);
  };

  useEffect(() => {
    getActivity();
  }, []);

  return (
    <div className="p-4 ">
      <h2 className="text-xl font-bold mb-4">Random Activity</h2>
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : activityData ? (
        <div className="space-y-2">
          <p id="activity" className="mb-2">
            <span className="font-semibold">Activity:</span> {activityData.activity}
          </p>
          <p id="type" className="mb-2">
            <span className="font-semibold">Type:</span> {activityData.type}
          </p>
          <p id="participants" className="mb-2">
            <span className="font-semibold">Min Participants:</span> {activityData.participants}
          </p>
          {activityData.link && activityData.link.trim() !== "" && (
            <p id="link" className="mb-2">
              <span className="font-semibold">Link:</span>{" "}
              <a
                href={activityData.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:underline"
              >
                {activityData.link}
              </a>
            </p>
          )}
          <p id="smlTxt" className="text-sm">
            Enjoy your activity!
          </p>
        </div>
      ) : (
        <p>No activity available.</p>
      )}
      <button
        id="getActivityButton"
        onClick={refreshActivity}
        className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded hover:bg-gradient-to-r from-indigo-600 to-purple-600 focus:outline-none"
      >
        Get New Activity
      </button>
    </div>
  );
};

export default RandomActivity;
