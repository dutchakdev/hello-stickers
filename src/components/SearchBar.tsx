import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  selectedType: string;
  productTypes: string[];
  onFilterByType: (type: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  selectedType, 
  productTypes, 
  onFilterByType 
}) => {
  const [query, setQuery] = useState('');
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch(value);
  };
  
  return (
    <div className="flex w-full mb-4">
      <div className="relative flex-grow">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
          </svg>
        </div>
        <input
          type="search"
          className="block w-full p-4 pl-10 text-sm text-gray-900 border border-gray-300 rounded-l-lg bg-white focus:ring-blue-500 focus:border-blue-500"
          placeholder="Search products by name, type, SKU, or barcode..."
          value={query}
          onChange={handleChange}
        />
      </div>
      <select 
        value={selectedType} 
        onChange={(e) => onFilterByType(e.target.value)}
        className="p-4 text-sm text-gray-900 border border-gray-300 border-l-0 rounded-r-lg bg-white focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="all">All Types</option>
        {productTypes.map(type => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
    </div>
  );
};

export default SearchBar; 