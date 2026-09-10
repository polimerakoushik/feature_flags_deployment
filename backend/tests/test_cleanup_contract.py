def test_cleanup_router_exposes_expected_contract():
    from routers.cleanup import router
    paths = {route.path for route in router.routes}
    assert "/cleanup/scan" in paths
    assert "/cleanup/suggestions" in paths
    assert "/cleanup/suggestions/{flag_id}/review" in paths
