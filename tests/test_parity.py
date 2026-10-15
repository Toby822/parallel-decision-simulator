"""Cross-runtime checks: this verifies the actual browser engine against Python."""

import json
import shutil
import subprocess
import unittest
from pathlib import Path

import numpy as np

from parallel.engine import default_scenario, simulate


class BrowserParity(unittest.TestCase):
    def test_browser_matches_python_across_seeds_and_preferences(self):
        root=Path(__file__).resolve().parent.parent
        for seed,time_value,months in [(42,0,36),(0,20,12),(987654,7,1)]:
            with self.subTest(seed=seed,time_value=time_value,months=months):
                s=default_scenario();s.update(paths=600,seed=seed,time_value=time_value,months=months)
                py=simulate(s)
                js=json.loads(subprocess.check_output([shutil.which('node'),'tests/browser-run.cjs'],input=json.dumps(s).encode(),cwd=root))
                for key in ['a','b']:
                    np.testing.assert_allclose(py['terminal'][key],js['terminal'][key],rtol=1e-12,atol=1e-7)
                for i in range(2):
                    for key in ['mean','median','p10','p90','worst_decile_mean','buffer_breach','expected_regret']:
                        self.assertAlmostEqual(py['options'][i][key],js['options'][i][key],places=7)
                    np.testing.assert_allclose(py['options'][i]['timeline'],js['options'][i]['timeline'],atol=1e-7)
                for key in ['probability_b_ahead','ties','mean_difference','median_difference','break_even_rent_b','monte_carlo_se']:
                    self.assertAlmostEqual(py['comparison'][key],js['comparison'][key],places=7)


if __name__=='__main__':
    unittest.main()
