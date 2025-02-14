import React from 'react';

const DownloadPDF: React.FC = () => {
  return (
    <div className=" flex flex-col items-center justify-center">
      <a 
        href="/PDF/2025Resume.pdf" 
        download
        className="px-6 py-3 bg-indigo-500 text-white font-semibold rounded hover:bg-indigo-600 transition-colors"
      >
        Download My Resume
      </a>
    </div>
  );
};

export default DownloadPDF;
