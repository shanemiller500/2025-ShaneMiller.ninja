'use client';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface UserDetails {
  ip: string;
  country_name: string;
  city: string;
  state_prov: string;
  latitude: string;
  longitude: string;
}

export default function WidgetSponsor() {
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

  // Function to fetch user details from IP Geolocation API
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await axios.get('https://ipgeolocation.io/ip-location?apiKey=ae6c00b2b7f241688b99fc77c3ddb58d')
        .then(response => {
          console.log(response.data);
        })
        .catch(error => {
          console.error('Error fetching user details:', error.message);
          console.error('Error details:', error.config);
          console.error('Request URL:', error.config.url);
          console.error('Response:', error.response);
        });
      
      } catch (error) {
        console.error('Error fetching user details:', error);
      }
    };

    fetchUserDetails();
  }, []);

  // Show a loading message while the data is being fetched
  if (!userDetails) {
    return <div className="rounded-lg border p-5">Loading...</div>;
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-gradient-to-t dark:from-slate-800 dark:to-slate-800/30 odd:-rotate-1 even:rotate-1 hover:rotate-0 transition-transform duration-700 hover:duration-100 ease-in-out p-5">
      <h2 className="text-lg font-bold">User Details</h2>
      <p><strong>IP Address:</strong> {userDetails.ip}</p>
      <p><strong>Country:</strong> {userDetails.country_name}</p>
      <p><strong>City:</strong> {userDetails.city}</p>
      <p><strong>Region:</strong> {userDetails.state_prov}</p>
      <p><strong>Latitude:</strong> {userDetails.latitude}</p>
      <p><strong>Longitude:</strong> {userDetails.longitude}</p>
    </div>
  );
}
