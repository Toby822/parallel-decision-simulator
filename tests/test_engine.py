import copy
import math
import unittest

from parallel.engine import RNG, default_scenario, simulate, validate


class DecisionProperties(unittest.TestCase):
    def setUp(self):
        self.s = default_scenario()
        self.s.update(paths=600, months=24)

    def test_identical_choices_have_zero_regret_and_only_ties(self):
        self.s['options'][1] = copy.deepcopy(self.s['options'][0])
        r = simulate(self.s)
        self.assertEqual(r['comparison']['ties'], 1)
        self.assertEqual(r['comparison']['probability_b_ahead'], 0)
        self.assertEqual(r['comparison']['preferred'], -1)
        self.assertEqual(r['comparison']['mean_difference'], 0)
        self.assertEqual(r['options'][0]['expected_regret'], 0)
        self.assertEqual(r['terminal']['a'], r['terminal']['b'])

    def test_same_seed_reproduces_every_path(self):
        a, b = simulate(self.s), simulate(self.s)
        self.assertEqual(a, b)

    def test_lower_rent_improves_every_paired_london_path(self):
        a = simulate(self.s)
        self.s['options'][1]['rent'] -= 100
        b = simulate(self.s)
        for before, after in zip(a['terminal']['b'], b['terminal']['b']):
            self.assertGreater(after, before)
        gain = b['comparison']['mean_difference'] - a['comparison']['mean_difference']
        self.assertAlmostEqual(gain, a['comparison']['rent_change_per_100'], places=7)
        self.assertEqual(a['terminal']['a'], b['terminal']['a'])

    def test_break_even_is_an_exact_paired_mean_tie(self):
        a = simulate(self.s)
        self.s['options'][1]['rent'] = a['comparison']['break_even_rent_b']
        b = simulate(self.s)
        self.assertAlmostEqual(b['comparison']['mean_difference'], 0, places=7)

    def test_income_sensitivity_has_expected_slope(self):
        a = simulate(self.s)
        self.s['options'][1]['income'] += 100
        b = simulate(self.s)
        self.assertAlmostEqual(b['comparison']['mean_difference']-a['comparison']['mean_difference'],
                               a['comparison']['income_b_change_per_100'], places=7)

    def test_time_preference_changes_score_without_changing_cash(self):
        a = simulate(self.s)
        self.s['time_value'] = 20
        b = simulate(self.s)
        time_difference = (32-16)*self.s['months']*20
        self.assertEqual(a['terminal'], b['terminal'])
        self.assertAlmostEqual(a['comparison']['mean_difference']-b['comparison']['mean_difference'], time_difference, places=7)

    def test_higher_buffer_cannot_reduce_breach_probability(self):
        a = simulate(self.s)
        self.s['buffer'] = 15000
        b = simulate(self.s)
        for i in range(2):
            self.assertGreaterEqual(b['options'][i]['buffer_breach'], a['options'][i]['buffer_breach'])
        self.assertEqual(b['options'][1]['buffer_breach'], 1)

    def test_regret_identity_and_bounds(self):
        r = simulate(self.s)
        a, b = r['options']
        self.assertAlmostEqual(a['expected_regret']-b['expected_regret'],r['comparison']['mean_difference'],places=7)
        self.assertAlmostEqual(min(a['expected_regret'],b['expected_regret']),r['comparison']['perfect_information_upper_bound'],places=7)
        for o in r['options']:
            self.assertLessEqual(o['p10'],o['median'])
            self.assertLessEqual(o['median'],o['p90'])
            self.assertLessEqual(o['worst_decile_mean'],o['p10'])
            self.assertTrue(0<=o['buffer_breach']<=1)
        self.assertEqual(sum(r['comparison']['histogram']['counts']),self.s['paths'])

    def test_zero_seed_is_valid_and_non_degenerate(self):
        rng = RNG(0)
        draws = [rng.uniform() for _ in range(50)]
        self.assertEqual(len(set(draws)),50)
        self.assertTrue(all(0<x<1 for x in draws))

    def test_invalid_inputs_are_rejected(self):
        for k,v in [('paths',0),('paths',1e8),('seed',-1),('months',3.5),('buffer',math.nan),('time_value',-1),('savings',True)]:
            s=copy.deepcopy(self.s);s[k]=v
            with self.subTest(k=k,v=v),self.assertRaises(ValueError):validate(s)


if __name__=='__main__':
    unittest.main()
