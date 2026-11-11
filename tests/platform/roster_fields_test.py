import pathlib, sys, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'scripts' / 'wikimedia-rosters'))
from roster_fields import explicit_current_club

class ExplicitAflClubFields(unittest.TestCase):
    def check(self, fields):
        return explicit_current_club(fields, lambda value: str(value).strip(), lambda value: value.lower())

    def test_renamed_field_preserves_explicit_club_without_inference(self):
        self.assertEqual(self.check({'current_club': 'Western Bulldogs'}), ('Western Bulldogs', False))
        self.assertEqual(self.check({'currentclub': 'Western Bulldogs'}), ('Western Bulldogs', False))
        self.assertEqual(self.check({'club1': 'Western Bulldogs'}), ('', False))

    def test_conflicting_current_fields_are_quarantined(self):
        self.assertTrue(self.check({'currentclub': 'St Kilda', 'current_club': 'Carlton'})[1])
        self.assertFalse(self.check({'currentclub': 'St Kilda', 'current_club': 'st kilda'})[1])

if __name__ == '__main__': unittest.main()
