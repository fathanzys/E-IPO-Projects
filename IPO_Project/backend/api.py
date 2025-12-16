from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from main import IPOAnalytics

app = FastAPI(title="IPO Profit Hunter API")
analytics = IPOAnalytics()

# Konfigurasi CORS
origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IPOInput(BaseModel):
    ticker: str
    final_price: float
    shares_offered: int
    low_price: float
    high_price: float
    has_warrant: bool
    lead_underwriter: str
    sector: str
    is_oversubscribed: bool

@app.get("/")
def read_root():
    return {"message": "IPO Analytics AI is Running 🚀"}

@app.get("/api/ipo-data")
def get_ipo_data():
    return analytics.get_all_data()

@app.post("/predict")
def predict_ipo(data: IPOInput):
    data_dict = data.dict()
    result = analytics.predict_new_ipo(data_dict)
    if result['status'] == 'error':
        raise HTTPException(status_code=500, detail=result['message'])
    return result