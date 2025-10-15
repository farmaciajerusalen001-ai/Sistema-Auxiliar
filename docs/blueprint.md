# **App Name**: PharmaCentral

## Core Features:

- Excel Import & Consolidation: Import product data from separate Excel sheets (one per branch) and create a consolidated master list, calculating subtotals. Use an LLM to recognize different data types. This feature will include a tool for users to correct misclassified data.
- Automated Drugstore Classification: Classify products into corresponding drugstores or labs based on predefined data in the database, saving products into its respective views. The backend will determine whether a product's characteristics conform to any such defined categorizations.
- Dynamic Product Views: Display products categorized by drugstore, each as its own 'virtual sheet'. Enable easy navigation, filtering, and real-time editing.
- Unit Conversion Tool: Enable selection of units (current and desired), including input of equivalencies to show an auto-calculated conversion. Uses unit coherency rules to restrict possible choices of units.
- Report Generation: Generate dynamic reports based on product data and conversions. Allow users to export results to Excel or PDF format.
- Intuitive UI with Real-Time Validation: Develop modern UI with TailwindCSS for smooth forms and toast notifications (success, error, warnings). Incorporate buttons for main functions (Import, Calculate, Save, Delete).

## Style Guidelines:

- Primary color: Deep blue (#3F51B5), providing a sense of trust, security, and efficiency which aligns well with pharmaceuticals.
- Background color: Light gray (#F0F2F5), offering a clean and neutral backdrop that won't distract from important product data.
- Accent color: Vibrant purple (#9C27B0) for highlighting important CTAs and data points, adding a touch of modernity.
- Body font: 'Inter', a grotesque-style sans-serif, will be used to maintain a modern and objective user interface.
- Headline font: 'Space Grotesk', a proportional sans-serif font will be used to maintain a modern user interface.
- Use clear, consistent icons that match the application's tone. Preferably outline style to reduce visual clutter and improve recognition.
- A clean, modern design, optimized for readability and easy navigation, with clear, logically structured forms.
- Subtle transitions and loading animations to provide a smooth and engaging user experience.