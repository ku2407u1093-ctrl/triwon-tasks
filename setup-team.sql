-- Run AFTER you have created the 4 users in Authentication → Users.
-- Change 'Your Name' to your real name.

update public.profiles set role = 'admin',  full_name = 'DBP Team', color = '#475467' where username = 'admin';
update public.profiles set role = 'member', full_name = 'Bhavya',    color = '#7A5AF8' where username = 'bhavya';
update public.profiles set role = 'member', full_name = 'Dhruv',     color = '#0E9384' where username = 'dhruv';
update public.profiles set role = 'member', full_name = 'Parth',     color = '#E04F16' where username = 'parth';

-- Check: you should see 4 rows, one admin
select username, full_name, role from public.profiles order by role, username;
