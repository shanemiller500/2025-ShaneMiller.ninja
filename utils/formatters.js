// utils/formatters.js
export function formatSupplyValue(supplyValue) {
    const supplyNumber = parseFloat(supplyValue);
    if (!isNaN(supplyNumber)) {
      return supplyNumber.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
    }
    return 'Invalid value';
  }
  
  export function formatDate(timestamp, formatType = 'default') {
    const date = new Date(timestamp * 1000);
    if (formatType === 'default') {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
    } else if (formatType === 'short') {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short',
      });
    } else if (formatType === 'time') {
      return date.toLocaleTimeString();
    }
  }
  
  export function formatDateWeirdValue(dateString) {
    const date = new Date(dateString);
    const options = { month: 'short', day: '2-digit', year: 'numeric' };
    const formatted = date.toLocaleDateString('en-US', options);
    return formatted.split(' ').join(' ');
  }
  