class VersionService:
    def get_latest_version(self, flag_id: int):
        return {"flag_id": flag_id, "version": 1}
