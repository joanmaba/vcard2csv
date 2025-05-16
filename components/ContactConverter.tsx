import { useState, useCallback, useRef } from 'react';
import { X, FileText, Download, Upload, Check, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';

export default function ContactConverter() {
  const [files, setFiles] = useState<File[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverted, setIsConverted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_FILES = 3000;

  // Gestionar l'arrossegament de fitxers (drag & drop)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (files.length + droppedFiles.length > MAX_FILES) {
      setError(`No es poden afegir més de ${MAX_FILES} arxius.`);
      return;
    }
    
    setFiles(prevFiles => [...prevFiles, ...droppedFiles]);
    setError(null);
  }, [files.length]);

  // Gestionar la selecció de fitxers amb el botó
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > MAX_FILES) {
      setError(`No es poden afegir més de ${MAX_FILES} arxius.`);
      return;
    }
    
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
    setError(null);
    // Reset input value to allow selecting the same file multiple times
    e.target.value = '';
  }, [files.length]);

  // Eliminar un fitxer de la llista
  const removeFile = useCallback((indexToRemove: number) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  }, []);

  // Eliminar tots els fitxers
  const clearFiles = useCallback(() => {
    setFiles([]);
    setContacts([]);
    setIsConverted(false);
    setError(null);
  }, []);

  // Parsejar un contacte vCard
  const parseVCard = useCallback((vCardContent: string) => {
    // Dividim per cada contacte (cada contacte comença amb BEGIN:VCARD)
    const cards = vCardContent.split('BEGIN:VCARD').filter(card => card.trim().length > 0);
    
    const parsedContacts: any[] = [];
    
    for (const card of cards) {
      const contact: any = {};
      // Afegim el prefix que hem tret abans
      const fullCard = `BEGIN:VCARD${card}`;
      
      // Extraem els camps comuns
      const nameMatch = fullCard.match(/N:([^;]*)(;([^;]*))?(;([^;]*))?(;([^;]*))?(;([^\r\n]*))?/);
      if (nameMatch) {
        contact.lastName = nameMatch[1]?.trim() || '';
        contact.firstName = nameMatch[3]?.trim() || '';
        contact.middleName = nameMatch[5]?.trim() || '';
        contact.prefix = nameMatch[7]?.trim() || '';
        contact.suffix = nameMatch[9]?.trim() || '';
      }
      
      // Format de nom per mostrar
      const fnMatch = fullCard.match(/FN:([^\r\n]*)/);
      if (fnMatch) {
        contact.fullName = fnMatch[1]?.trim() || '';
      }
      
      // Telèfon
      const telMatches = fullCard.matchAll(/TEL(;[^:]*)?:([^\r\n]*)/g);
      let phoneCounter = 1;
      for (const match of telMatches) {
        const phoneType = match[1] ? match[1].toLowerCase() : '';
        const phoneNumber = match[2]?.trim();
        
        if (phoneType.includes('cell') || phoneType.includes('mobile')) {
          contact.mobilePhone = phoneNumber;
        } else if (phoneType.includes('work')) {
          contact.workPhone = phoneNumber;
        } else if (phoneType.includes('home')) {
          contact.homePhone = phoneNumber;
        } else {
          contact[`phone${phoneCounter}`] = phoneNumber;
          phoneCounter++;
        }
      }
      
      // Email
      const emailMatches = fullCard.matchAll(/EMAIL(;[^:]*)?:([^\r\n]*)/g);
      let emailCounter = 1;
      for (const match of emailMatches) {
        const emailType = match[1] ? match[1].toLowerCase() : '';
        const email = match[2]?.trim();
        
        if (emailType.includes('work')) {
          contact.workEmail = email;
        } else if (emailType.includes('home')) {
          contact.homeEmail = email;
        } else {
          contact[`email${emailCounter}`] = email;
          emailCounter++;
        }
      }
      
      // Adreça
      const adrMatches = fullCard.matchAll(/ADR(;[^:]*)?:([^;]*);([^;]*);([^;]*);([^;]*);([^;]*);([^;]*);([^\r\n]*)/g);
      let addressCounter = 1;
      for (const match of adrMatches) {
        const addressType = match[1] ? match[1].toLowerCase() : '';
        const poBox = match[2]?.trim();
        const extendedAddress = match[3]?.trim();
        const street = match[4]?.trim();
        const city = match[5]?.trim();
        const region = match[6]?.trim();
        const postalCode = match[7]?.trim();
        const country = match[8]?.trim();
        
        const addressPrefix = addressType.includes('work') ? 'work' : 
                             addressType.includes('home') ? 'home' : 
                             `address${addressCounter}`;
        
        if (poBox) contact[`${addressPrefix}PoBox`] = poBox;
        if (extendedAddress) contact[`${addressPrefix}ExtAddr`] = extendedAddress;
        if (street) contact[`${addressPrefix}Street`] = street;
        if (city) contact[`${addressPrefix}City`] = city;
        if (region) contact[`${addressPrefix}Region`] = region;
        if (postalCode) contact[`${addressPrefix}PostalCode`] = postalCode;
        if (country) contact[`${addressPrefix}Country`] = country;
        
        if (!addressType.includes('work') && !addressType.includes('home')) {
          addressCounter++;
        }
      }
      
      // Organització
      const orgMatch = fullCard.match(/ORG:([^\r\n]*)/);
      if (orgMatch) {
        const orgs = orgMatch[1].split(';');
        contact.organization = orgs[0]?.trim() || '';
        contact.department = orgs[1]?.trim() || '';
      }
      
      // Títol / Càrrec
      const titleMatch = fullCard.match(/TITLE:([^\r\n]*)/);
      if (titleMatch) {
        contact.jobTitle = titleMatch[1]?.trim() || '';
      }
      
      // Notes
      const noteMatch = fullCard.match(/NOTE:([^\r\n]*)/);
      if (noteMatch) {
        contact.notes = noteMatch[1]?.trim() || '';
      }
      
      // URL
      const urlMatch = fullCard.match(/URL:([^\r\n]*)/);
      if (urlMatch) {
        contact.website = urlMatch[1]?.trim() || '';
      }
      
      // Aniversari / Data de naixement
      const bdayMatch = fullCard.match(/BDAY:([^\r\n]*)/);
      if (bdayMatch) {
        contact.birthday = bdayMatch[1]?.trim() || '';
      }
      
      parsedContacts.push(contact);
    }
    
    return parsedContacts;
  }, []);

  // Convertir tots els fitxers a CSV
  const convertToCSV = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    const allContacts: any[] = [];
    
    try {
      for (const file of files) {
        const content = await file.text();
        
        // Detectar el tipus de fitxer i processar-lo adequadament
        if (file.name.endsWith('.vcf') || content.includes('BEGIN:VCARD')) {
          // Processar com a vCard
          const parsedContacts = parseVCard(content);
          allContacts.push(...parsedContacts);
        } else {
          throw new Error(`Format de fitxer no suportat: ${file.name}`);
        }
      }
      
      setContacts(allContacts);
      setIsConverted(true);
      setIsProcessing(false);
    } catch (err) {
      setError(`Error en processar els fitxers: ${err instanceof Error ? err.message : String(err)}`);
      setIsProcessing(false);
    }
  }, [files, parseVCard]);

  // Descarregar el CSV
  const downloadCSV = useCallback(() => {
    if (contacts.length === 0) return;
    
    // Unificar totes les claus
    const allKeys = new Set<string>();
    contacts.forEach(contact => {
      Object.keys(contact).forEach(key => allKeys.add(key));
    });
    
    // Convertir a CSV
    const csv = Papa.unparse({
      fields: Array.from(allKeys),
      data: contacts.map(contact => {
        const row: Record<string, string> = {};
        Array.from(allKeys).forEach(key => {
          row[key] = contact[key] || '';
        });
        return row;
      })
    });
    
    // Crear el blob i descarregar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'contactes.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [contacts]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-black text-white py-4 shadow-md">
        <div className="container mx-auto px-4 flex items-center">
          <img src="/img/CitaFacil ISOTIP LOGO NO BACKGROUND.png" alt="CitaFacil Logo" className="h-10 w-10 mr-4" />
          <div>
            <h1 className="text-2xl font-bold">Convertidor de Contactes a CSV</h1>
            <p className="text-gray-300">Converteix vCards i altres formats a CSV</p>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 flex-grow">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">1. Selecciona els fitxers de contactes</h2>
          
          {/* Àrea de selecció d'arxius */}
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer mb-4 ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Arrossega els fitxers de contactes aquí o <span className="text-blue-600 font-medium">fes clic per seleccionar</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Formats acceptats: vCard (.vcf)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              multiple
              accept=".vcf"
            />
          </div>
          
          {/* Comptador d'arxius */}
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">
              {files.length} {files.length === 1 ? 'fitxer seleccionat' : 'fitxers seleccionats'} (màxim {MAX_FILES})
            </p>
            {files.length > 0 && (
              <button 
                onClick={clearFiles}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Esborrar tot
              </button>
            )}
          </div>
          
          {/* Missatge d'error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          
          {/* Llista de fitxers */}
          {files.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <ul className="divide-y divide-gray-200">
                {files.map((file, index) => (
                  <li key={index} className="p-3 flex justify-between items-center hover:bg-gray-50">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm">{file.name}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button 
                      onClick={() => removeFile(index)} 
                      className="text-gray-400 hover:text-red-600"
                      aria-label="Eliminar fitxer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Botó de conversió */}
          <button
            onClick={convertToCSV}
            disabled={files.length === 0 || isProcessing}
            className={`mt-6 w-full py-2 px-4 rounded-md font-medium ${
              files.length === 0 || isProcessing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isProcessing ? 'Processant...' : 'Convertir a CSV'}
          </button>
        </div>
        
        {/* Secció de descàrrega */}
        {isConverted && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">2. Descarregar resultat</h2>
            
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4 flex items-center">
              <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
              <div>
                <p className="text-green-800 font-medium">Conversió completada!</p>
                <p className="text-sm text-green-700">
                  S'han processat {contacts.length} contactes de {files.length} {files.length === 1 ? 'fitxer' : 'fitxers'}.
                </p>
              </div>
            </div>
            
            <button
              onClick={downloadCSV}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 flex items-center justify-center"
            >
              <Download className="h-5 w-5 mr-2" />
              Descarregar CSV
            </button>
          </div>
        )}
      </main>
      
      <footer className="bg-gray-100 py-4 text-center text-gray-600 text-sm">
        <p>Convertidor de Contactes vCard a CSV © CitaFacil</p>
      </footer>
    </div>
  );
} 