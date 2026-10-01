"""
BlueGrid AI Integration Test Suite
Validates backend REST endpoints, SQLite operations, and optimization computations.
"""

import unittest
from backend.app import app

class BlueGridIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()

    def test_01_health_check(self):
        res = self.client.get('/api/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertEqual(data.get('backend'), 'Connected')

    def test_02_static_frontend(self):
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('BLUEGRID', res.get_data(as_text=True))

    def test_03_islands_catalog(self):
        res = self.client.get('/api/islands?region=Lakshadweep')
        self.assertEqual(res.status_code, 200)
        islands = res.get_json()['islands']
        self.assertGreaterEqual(len(islands), 6)

    def test_04_optimization_engine(self):
        res = self.client.post('/api/optimize', json={
            'island_id': 1,
            'target_renewable_pct': 85
        })
        self.assertEqual(res.status_code, 200)
        opt = res.get_json()
        self.assertIn('run_id', opt)
        self.assertGreater(opt['optimization_score']['total_score'], 75)
        self.assertGreater(opt['environmental_impact']['diesel_reduction_pct'], 70)

    def test_05_report_generation(self):
        # Run optimization first
        r_opt = self.client.post('/api/optimize', json={'island_id': 1})
        run_id = r_opt.get_json()['run_id']
        res = self.client.get(f'/api/report/{run_id}')
        self.assertEqual(res.status_code, 200)
        report = res.get_json()['report']
        self.assertEqual(len(report['sections']), 14)

    def test_06_simulation_sandbox(self):
        res = self.client.post('/api/simulate', json={
            'demand_multiplier': 1.2,
            'solar_kw': 1000,
            'wind_kw': 300,
            'otec_kw': 250,
            'battery_kwh': 1500
        })
        self.assertEqual(res.status_code, 200)
        sim = res.get_json()
        self.assertIn('renewable_penetration_pct', sim)
        self.assertGreater(sim['score'], 60)

    def test_07_niot_csv_validation(self):
        csv_sample = "name,latitude,longitude,peak_demand_mw,average_demand_mw\nTest Island,10.1,72.1,0.5,0.3"
        res = self.client.post('/api/niot/preview', json={'csv_text': csv_sample})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['data']['valid_count'], 1)

if __name__ == '__main__':
    unittest.main()
