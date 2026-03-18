import os
from pathlib import Path
from unittest.mock import patch

from src.utils import truncate_text, get_static_dir, open_browser


class TestTruncateText:
    def test_short_text_unchanged(self):
        assert truncate_text("hello", 10) == "hello"

    def test_exact_length_unchanged(self):
        assert truncate_text("hello", 5) == "hello"

    def test_long_text_truncated_with_ellipsis(self):
        assert truncate_text("hello world", 8) == "hello..."

    def test_empty_string(self):
        assert truncate_text("", 5) == ""


class TestGetStaticDir:
    def test_returns_client_dist_relative_to_server(self):
        static_dir = get_static_dir()
        # Should point to client/dist relative to the project root
        assert static_dir.name == "dist"
        assert static_dir.parent.name == "client"

    def test_returns_path_object(self):
        static_dir = get_static_dir()
        assert isinstance(static_dir, Path)


class TestOpenBrowser:
    @patch("src.utils.webbrowser.open")
    def test_opens_url(self, mock_open):
        open_browser("http://localhost:8000")
        mock_open.assert_called_once_with("http://localhost:8000")

    @patch("src.utils.webbrowser.open", side_effect=Exception("no browser"))
    def test_does_not_raise_on_failure(self, mock_open):
        # Should silently ignore errors
        open_browser("http://localhost:8000")
