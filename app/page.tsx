'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

interface HalvingEvent {
  date: string;
  blockHeight: number;
  cycle: number;
  priceAtHalving: number;
}

interface CycleAnalysis {
  cycle: number;
  halvingDate: string;
  preHalvingData: {
    days: number;
    startPrice: number;
    halvingPrice: number;
    percentageGain: number;
  };
  postHalvingData: {
    days: number;
    halvingPrice: number;
    peakPrice: number;
    peakDate: string;
    percentageGain: number;
    daysToTop: number;
  };
  crashData: {
    crashDate: string;
    bottomPrice: number;
    percentageFromPeak: number;
  };
}

export default function Home() {
  const [priceData, setPriceData] = useState<any[]>([]);
  const [cycleAnalysis, setCycleAnalysis] = useState<CycleAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const halvingEvents: HalvingEvent[] = [
    { date: '2012-11-28', blockHeight: 210000, cycle: 1, priceAtHalving: 12.35 },
    { date: '2016-07-09', blockHeight: 420000, cycle: 2, priceAtHalving: 650.63 },
    { date: '2020-05-11', blockHeight: 630000, cycle: 3, priceAtHalving: 8821.42 },
    { date: '2024-04-19', blockHeight: 840000, cycle: 4, priceAtHalving: 63812.00 },
  ];

  useEffect(() => {
    fetchHistoricalData();
  }, []);

  const fetchHistoricalData = async () => {
    try {
      // Fetch Bitcoin price data from CoinGecko API (free, no key needed)
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=max&interval=daily'
      );
      const data = await response.json();

      const formattedData = data.prices.map((item: [number, number]) => ({
        timestamp: item[0],
        date: format(new Date(item[0]), 'yyyy-MM-dd'),
        price: item[1],
      }));

      setPriceData(formattedData);
      performBacktest(formattedData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  const performBacktest = (data: any[]) => {
    const analyses: CycleAnalysis[] = [];

    halvingEvents.forEach((halving, index) => {
      const halvingTimestamp = new Date(halving.date).getTime();

      // Pre-halving analysis (365 days before)
      const preHalvingStart = halvingTimestamp - (365 * 24 * 60 * 60 * 1000);
      const preHalvingDataPoints = data.filter(
        d => d.timestamp >= preHalvingStart && d.timestamp <= halvingTimestamp
      );

      const startPrice = preHalvingDataPoints[0]?.price || 0;
      const halvingPrice = preHalvingDataPoints[preHalvingDataPoints.length - 1]?.price || halving.priceAtHalving;
      const preHalvingGain = ((halvingPrice - startPrice) / startPrice) * 100;

      // Post-halving analysis (find peak - typically 12-18 months after halving)
      const postHalvingEnd = halvingTimestamp + (730 * 24 * 60 * 60 * 1000); // 2 years after
      const postHalvingDataPoints = data.filter(
        d => d.timestamp > halvingTimestamp && d.timestamp <= postHalvingEnd
      );

      const peak = postHalvingDataPoints.reduce((max, point) =>
        point.price > max.price ? point : max
      , postHalvingDataPoints[0] || { price: 0, date: '', timestamp: 0 });

      const peakPrice = peak?.price || 0;
      const peakDate = peak?.date || '';
      const daysToTop = Math.floor((peak?.timestamp - halvingTimestamp) / (24 * 60 * 60 * 1000));
      const postHalvingGain = ((peakPrice - halvingPrice) / halvingPrice) * 100;

      // Find crash/bottom after peak
      const afterPeak = data.filter(d => d.timestamp > peak?.timestamp);
      const bottomAfterPeak = afterPeak.slice(0, 365).reduce((min, point) =>
        point.price < min.price ? point : min
      , afterPeak[0] || { price: peakPrice, date: '', timestamp: 0 });

      const crashPercentage = ((bottomAfterPeak.price - peakPrice) / peakPrice) * 100;

      analyses.push({
        cycle: halving.cycle,
        halvingDate: halving.date,
        preHalvingData: {
          days: 365,
          startPrice,
          halvingPrice,
          percentageGain: preHalvingGain,
        },
        postHalvingData: {
          days: postHalvingDataPoints.length,
          halvingPrice,
          peakPrice,
          peakDate,
          percentageGain: postHalvingGain,
          daysToTop,
        },
        crashData: {
          crashDate: bottomAfterPeak.date,
          bottomPrice: bottomAfterPeak.price,
          percentageFromPeak: crashPercentage,
        },
      });
    });

    setCycleAnalysis(analyses);
  };

  const getChartData = () => {
    return priceData.map(d => ({
      date: d.date,
      price: d.price,
      timestamp: d.timestamp,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl">Loading Bitcoin data...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Bitcoin Halving Analysis & Backtest</h1>
        <p className="text-gray-400 mb-8">Historical analysis of Bitcoin price movements around halving events</p>

        {/* Price Chart */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Bitcoin Price History (Log Scale)</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={getChartData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                tickFormatter={(date) => format(new Date(date), 'yyyy')}
                interval={365}
              />
              <YAxis
                stroke="#9CA3AF"
                scale="log"
                domain={['auto', 'auto']}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: any) => [`$${value.toLocaleString()}`, 'Price']}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#F59E0B"
                dot={false}
                strokeWidth={2}
                name="BTC Price (USD)"
              />
              {halvingEvents.map((halving) => (
                <ReferenceLine
                  key={halving.cycle}
                  x={halving.date}
                  stroke="#EF4444"
                  strokeDasharray="3 3"
                  label={{ value: `Halving ${halving.cycle}`, fill: '#EF4444', position: 'top' }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cycle Analysis Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {cycleAnalysis.map((analysis) => (
            <div key={analysis.cycle} className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-2xl font-bold mb-4 text-orange-400">
                Cycle {analysis.cycle} - Halving: {analysis.halvingDate}
              </h3>

              <div className="space-y-4">
                {/* Pre-Halving */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="text-lg font-semibold text-blue-400 mb-2">Pre-Halving (365 days)</h4>
                  <div className="space-y-1 text-sm">
                    <p>Start Price: <span className="text-white font-mono">${analysis.preHalvingData.startPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span></p>
                    <p>Halving Price: <span className="text-white font-mono">${analysis.preHalvingData.halvingPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span></p>
                    <p className="text-green-400 font-bold">
                      Gain: {analysis.preHalvingData.percentageGain.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Post-Halving */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="text-lg font-semibold text-green-400 mb-2">Post-Halving (to Peak)</h4>
                  <div className="space-y-1 text-sm">
                    <p>Halving Price: <span className="text-white font-mono">${analysis.postHalvingData.halvingPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span></p>
                    <p>Peak Price: <span className="text-white font-mono">${analysis.postHalvingData.peakPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span></p>
                    <p>Peak Date: <span className="text-white font-mono">{analysis.postHalvingData.peakDate}</span></p>
                    <p>Days to Peak: <span className="text-white font-mono">{analysis.postHalvingData.daysToTop} days</span></p>
                    <p className="text-green-400 font-bold">
                      Gain: {analysis.postHalvingData.percentageGain.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Crash/Correction */}
                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="text-lg font-semibold text-red-400 mb-2">Bear Market Correction</h4>
                  <div className="space-y-1 text-sm">
                    <p>Crash Date: <span className="text-white font-mono">{analysis.crashData.crashDate}</span></p>
                    <p>Bottom Price: <span className="text-white font-mono">${analysis.crashData.bottomPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</span></p>
                    <p className="text-red-400 font-bold">
                      Drawdown: {analysis.crashData.percentageFromPeak.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Statistics */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-2xl font-bold mb-4">Summary Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-lg font-semibold text-blue-400 mb-2">Avg Pre-Halving Gain</h4>
              <p className="text-3xl font-bold text-green-400">
                {(cycleAnalysis.reduce((sum, a) => sum + a.preHalvingData.percentageGain, 0) / cycleAnalysis.length).toFixed(2)}%
              </p>
              <p className="text-sm text-gray-400">365 days before halving</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-green-400 mb-2">Avg Post-Halving Gain</h4>
              <p className="text-3xl font-bold text-green-400">
                {(cycleAnalysis.reduce((sum, a) => sum + a.postHalvingData.percentageGain, 0) / cycleAnalysis.length).toFixed(2)}%
              </p>
              <p className="text-sm text-gray-400">Halving to cycle peak</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-red-400 mb-2">Avg Bear Market Drawdown</h4>
              <p className="text-3xl font-bold text-red-400">
                {(cycleAnalysis.reduce((sum, a) => sum + a.crashData.percentageFromPeak, 0) / cycleAnalysis.length).toFixed(2)}%
              </p>
              <p className="text-sm text-gray-400">Peak to cycle bottom</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Data source: CoinGecko API | Analysis updated in real-time</p>
          <p className="mt-2">Note: Past performance does not guarantee future results</p>
        </div>
      </div>
    </main>
  );
}
