import pandas as pd
import numpy as np
import os
import warnings
from typing import Optional, List, Dict, Any

# Machine Learning Libraries
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

# Configuration
warnings.filterwarnings('ignore')

class IPOAnalytics:
    def __init__(self):
        # Path dinamis
        base_path = os.path.dirname(os.path.abspath(__file__))
        self.ipo_path = os.path.join(base_path, 'e-IPO Data.csv')
        self.warrant_path = os.path.join(base_path, 'Warrant - Price D1.csv')
        
        # Inisialisasi variabel
        self.df: Optional[pd.DataFrame] = None
        self.df_train: Optional[pd.DataFrame] = None
        self.model: Optional[RandomForestClassifier] = None
        self.feature_names: List[str] = []
        self.top_underwriters: List[str] = []
        
        # Jalankan Pipeline
        print("[INFO] Initializing IPO Analytics Engine...")
        self.load_and_clean_data()
        self.feature_engineering()
        self.define_target()
        self.train_model()

    def load_and_clean_data(self):
        """Memuat dataset dan pembersihan dasar."""
        if not os.path.exists(self.ipo_path):
            print(f"[ERROR] File CSV tidak ditemukan di: {self.ipo_path}")
            return

        try:
            df_ipo = pd.read_csv(self.ipo_path)
            
            # Konversi Angka
            numeric_cols = ['Final Price (Rp)', 'Number of shares offered', 'Return D1', 
                            'Lowest Book Building Price (Rp)', 'Highest Book Building Price (Rp)']
            for col in numeric_cols:
                if col in df_ipo.columns:
                    df_ipo[col] = pd.to_numeric(df_ipo[col], errors='coerce')

            # Konversi Tanggal
            date_cols = ['Book Building Opening', 'Listing Date', 'Distribution Date']
            for col in date_cols:
                if col in df_ipo.columns:
                    df_ipo[col] = pd.to_datetime(df_ipo[col], errors='coerce')

            # Hapus Duplikat
            self.df = df_ipo.drop_duplicates(subset=['Ticker Code']).reset_index(drop=True)
            print(f"[INFO] Data loaded successfully. Total records: {len(self.df)}")
            
        except Exception as e:
            print(f"[ERROR] Failed to load data: {e}")
            self.df = None

    def feature_engineering(self):
        """Membuat fitur canggih untuk AI."""
        if self.df is None: return

        # 1. Offering Size (Miliar Rp)
        self.df['Offering_Size_Billion'] = (self.df['Final Price (Rp)'] * self.df['Number of shares offered']) / 1e9
        
        # 2. Price Positioning (0-1)
        numerator = self.df['Final Price (Rp)'] - self.df['Lowest Book Building Price (Rp)']
        denominator = self.df['Highest Book Building Price (Rp)'] - self.df['Lowest Book Building Price (Rp)']
        self.df['Price_Range_Pos'] = numerator / denominator
        self.df['Price_Range_Pos'] = self.df['Price_Range_Pos'].fillna(1.0)
        self.df.loc[np.isinf(self.df['Price_Range_Pos']), 'Price_Range_Pos'] = 1.0
        self.df['Price_Range_Pos'] = self.df['Price_Range_Pos'].clip(0.0, 1.0)

        # 3. Warrant
        self.df['Has_Warrant'] = (self.df['Warrant per share ratio'] > 0).astype(int)

        # 4. Underwriter
        self.df['Lead_Underwriter'] = self.df['Underwriter(s)'].astype(str).str.split(',').str[0].str.strip()
        self.top_underwriters = self.df['Lead_Underwriter'].value_counts().head(10).index.tolist()
        self.df['Is_Top_Underwriter'] = self.df['Lead_Underwriter'].isin(self.top_underwriters).astype(int)

        # 5. Month
        self.df['Listing_Month'] = pd.to_datetime(self.df['Listing Date']).dt.month

    def define_target(self):
        """Labeling Target (Loss, Profit, ARA)."""
        if self.df is None: return

        def categorize(val):
            if pd.isna(val): return None
            if val >= 0.20: return 2   # ARA
            elif val > 0: return 1     # Profit
            else: return 0             # Loss
        
        self.df['Target_Class'] = self.df['Return D1'].apply(categorize)
        self.df_train = self.df.dropna(subset=['Target_Class']).copy()

    def train_model(self):
        """Melatih Model Random Forest."""
        if self.df_train is None or self.df_train.empty:
            print("[ERROR] Training data is empty.")
            return

        features = ['Offering_Size_Billion', 'Price_Range_Pos', 'Has_Warrant', 
                    'Is_Top_Underwriter', 'Listing_Month', 'Sector']
        target = 'Target_Class'
        
        X = self.df_train[features].copy()
        y = self.df_train[target].astype(int)
        
        X = pd.get_dummies(X, columns=['Sector'], drop_first=True)
        self.feature_names = X.columns.tolist()
        
        self.model = RandomForestClassifier(
            n_estimators=300, max_depth=10, 
            min_samples_leaf=2, random_state=42, 
            class_weight='balanced'
        )
        self.model.fit(X, y)
        print("[INFO] Model Trained Successfully.")

    def get_all_data(self):
        """Mengembalikan list data IPO lengkap dengan Underwriter."""
        if self.df is None:
            return {"status": "error", "message": "Data belum dimuat"}
        
        try:
            # Kolom yang akan dikirim ke Frontend
            cols = ['Ticker Code', 'Company Name', 'Sector', 'Final Price (Rp)', 
                    'Listing Date', 'Return D1', 'Underwriter(s)']
            
            # Pastikan kolom tersedia
            available = [c for c in cols if c in self.df.columns]
            
            # Konversi ke Dictionary
            data_list = self.df[available].fillna("-").to_dict(orient='records')
            
            # Formatting Data agar cantik di Frontend
            for item in data_list:
                # Format Tanggal (ambil YYYY-MM-DD saja)
                if 'Listing Date' in item and str(item['Listing Date']) != '-':
                    item['Listing Date'] = str(item['Listing Date']).split(' ')[0]
                
                # Format Underwriter (Ambil kode broker pertama)
                if 'Underwriter(s)' in item:
                    # Contoh: "CC,LG,YP" -> "CC"
                    item['Lead_UW'] = str(item['Underwriter(s)']).split(',')[0].strip()
                
                # Hitung Harga Penutupan Hari Pertama
                if 'Final Price (Rp)' in item and 'Return D1' in item and item['Return D1'] != '-':
                    initial_price = float(item['Final Price (Rp)'])
                    ret = float(item['Return D1'])
                    item['D1_Close_Price'] = round(initial_price * (1 + ret))

            return {
                "status": "success",
                "total": len(data_list),
                "data": data_list
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def predict_new_ipo(self, data_dict: Dict[str, Any]):
        """Fungsi Inference AI."""
        if self.model is None:
            return {"status": "error", "message": "Model belum dilatih."}

        try:
            # Hitung Fitur Dinamis
            real_size = (data_dict['final_price'] * data_dict['shares_offered']) / 1e9
            
            denom = data_dict['high_price'] - data_dict['low_price']
            real_pos = (data_dict['final_price'] - data_dict['low_price']) / denom if denom != 0 else 1.0
            real_pos = np.clip(real_pos, 0.0, 1.0)
            
            # Vector Input
            input_df = pd.DataFrame(0, index=[0], columns=self.feature_names)
            
            if 'Offering_Size_Billion' in self.feature_names: input_df['Offering_Size_Billion'] = real_size
            if 'Price_Range_Pos' in self.feature_names: input_df['Price_Range_Pos'] = real_pos
            if 'Has_Warrant' in self.feature_names: input_df['Has_Warrant'] = 1 if data_dict['has_warrant'] else 0
            
            lead_uw = str(data_dict['lead_underwriter']).split(',')[0].strip()
            if 'Is_Top_Underwriter' in self.feature_names: 
                input_df['Is_Top_Underwriter'] = 1 if lead_uw in self.top_underwriters else 0
            
            if 'Listing_Month' in self.feature_names: input_df['Listing_Month'] = pd.Timestamp.now().month
            
            sector_col = f"Sector_{data_dict['sector']}"
            if sector_col in self.feature_names: input_df[sector_col] = 1

            # Prediksi
            probs = self.model.predict_proba(input_df)[0]
            pred_class = int(self.model.predict(input_df)[0])
            labels = ['Loss / Stagnant', 'Positive Profit', 'High Gain / ARA']
            
            return {
                "status": "success",
                "prediction": labels[pred_class],
                "probabilities": {
                    "loss": float(probs[0]),
                    "profit": float(probs[1]),
                    "ara": float(probs[2])
                },
                "metrics": {
                    "size_billion": float(real_size),
                    "price_pos": float(real_pos)
                }
            }
        except Exception as e:
            return {"status": "error", "message": f"Prediction Error: {str(e)}"}

if __name__ == "__main__":
    app = IPOAnalytics()
    print("Model Ready.")