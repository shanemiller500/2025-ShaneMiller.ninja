"use client";

import React, { useEffect } from "react";
import CountrySearch from "./CountrySearch"; 
import { trackEvent } from '@/utils/mixpanel';

const CountrySearchPage = () => {

    useEffect(() => {
      trackEvent('Country Page Viewed', { page: 'Country' });
    }, []);
  return (
    <div>
      <CountrySearch />
    </div>
  );
};

export default CountrySearchPage;
