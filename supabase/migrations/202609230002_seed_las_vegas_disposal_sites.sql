-- Sites and rates supplied by SSWSCO's September 2026 self-haul map.
insert into public.disposal_sites (name, address, material_rules, notes) values
('Republic Services Apex Landfill', '13550 North US Highway 93, Las Vegas, NV 89165', '["Call for current rate"]', 'Rate: call for current rate.'),
('Republic Services Cheyenne Transfer Station', '315 West Cheyenne Ave, North Las Vegas, NV 89030', '["Call for current rate"]', 'Rate: call for current rate.'),
('Republic Services Henderson Transfer Station', '560 Cape Horn Dr, Henderson, NV 89011', '["Call for current rate"]', 'Rate: call for current rate.'),
('Western Elite Nellis / Alto Dumpsite', '4975 Alto Ave, Las Vegas, NV 89115', '["C&D"]', 'Rate: $60 / ton (C&D).'),
('Western Elite Wynn Road Dumpsite', '4610 Wynn Rd, Las Vegas, NV 89103', '["C&D", "Dirt", "Rock", "Concrete", "Sod"]', 'Rates: $27 / cu yd (C&D); $47 / cu yd (dirt/rock/concrete/sod).'),
('Western Elite Henderson Dumpsite', '691 W Warm Springs Rd, Henderson, NV 89011', '["C&D"]', 'Rate: $67 / ton (C&D).'),
('Wells Cargo Material Sales & Class III', '7770 Spring Mountain Rd, Las Vegas, NV 89117', '["Call for current rate"]', 'Rate: call for current rate.'),
('Lunas Construction Clean-Up', '4830 E Cartier Ave, Las Vegas, NV 89115', '["Rate confirmed by phone"]', 'Rate: $13 / cu yd; confirm by phone.')
on conflict do nothing;
